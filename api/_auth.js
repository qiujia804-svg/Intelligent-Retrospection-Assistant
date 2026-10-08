/**
 * 服务端会员鉴权（Serverless 用）
 * ---------------------------------------------------------------
 * 用途：在 api/ai-plan.js、api/ai-review.js 等「花钱调大模型」的接口里，
 *       校验调用者是否真的拥有会员权益。前端那个点击门禁只能防君子，
 *       接口层鉴权才是真正的商业闭环。
 *
 * 判定链路（全部走真实网络请求，无 mock）：
 *   1. 从 Authorization: Bearer <token> 取用户 token
 *      —— token 由前端从 WorkBuddy Cloud SDK 的会话里取出
 *   2. GET {UPSTREAM}/.cloud/v1/user/me 验证 token 有效性，拿到 user.id
 *   3. GET {UPSTREAM}/.cloud/database/rest/memberships?select=... 查该用户的会员行
 *   4. 判定：is_premium 为 true 且在有效期内；或试用未过期
 *
 * 环境变量：
 *   CLOUD_UPSTREAM     云端地址（默认取内置常量，与 api/cloud.js 保持一致）
 *   CLOUD_PUBLISHABLE_KEY  publishableKey（前端 index.html 里那份，非机密）
 */

const DEFAULT_UPSTREAM = 'https://smart-review-09187.app.workbuddy.host';
const DEFAULT_PUBLISHABLE_KEY = 'wbpk_EyygHhJU0gq4U5gWEdwZqs_5dtxmQDkuDiGlQ1oSQGQAJIzWXRZrN4W';

const UPSTREAM = process.env.CLOUD_UPSTREAM || DEFAULT_UPSTREAM;
const PUBLISHABLE_KEY = process.env.CLOUD_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY;

// 云端强制 Origin 必须匹配注册域名，与 api/cloud.js 保持完全一致
const REGISTERED_ORIGIN = UPSTREAM;

const TRIAL_MS = 7 * 24 * 60 * 60 * 1000; // 与前端 TRIAL_MS 保持一致
const TIMEOUT_MS = 8000;

/** 统一的失败返回，调用方直接拿去响应 */
function deny(status, code, message) {
    return { ok: false, status, code, message };
}

/** 从请求头取 Bearer token */
function readToken(req) {
    const raw = req.headers && (req.headers.authorization || req.headers.Authorization);
    if (typeof raw !== 'string' || !raw) return null;
    const m = raw.match(/^Bearer\s+(.+)$/i);
    return m ? m[1].trim() : null;
}

/** 带超时的 fetch，避免上游卡住把 Serverless 拖死 */
async function fetchJson(url, token) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const headers = {
            // 与 api/cloud.js 转发时完全一致的头部组合——
            // 云端会同时校验 Origin（注册域名）、publishableKey 与 UA，
            // 少任何一个都会拿到 404 "endpoint is not available"。
            'x-wb-webapp-access-key': PUBLISHABLE_KEY,
            'origin': REGISTERED_ORIGIN,
            'accept': 'application/json'
        };
        if (token) headers['Authorization'] = 'Bearer ' + token;
        const res = await fetch(url, { method: 'GET', headers, signal: controller.signal });
        const text = await res.text();
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { /* 非 JSON，保持 null */ }
        return { status: res.status, ok: res.ok, json: json, text: text };
    } finally {
        clearTimeout(timer);
    }
}

/**
 * 校验调用者身份。
 * @returns {Promise<{ok:boolean,status:number,code:string,message:string,userId?:string,vipType?:string,reason?:string}>}
 */
async function requireMember(req) {
    const token = readToken(req);
    if (!token) {
        return deny(401, 'SIGN_IN_REQUIRED', '请先登录后再使用 AI 功能。');
    }

    // ---- 1. 验证 token 是否有效 ----
    // 路径必须与 SDK 实际发出的完全一致：/.cloud/auth/v1/user/me
    // （少了 /auth 这一段云端会返回 404 "endpoint is not available"）
    let me;
    try {
        me = await fetchJson(UPSTREAM + '/.cloud/auth/v1/user/me', token);
    } catch (e) {
        console.error('[auth] 校验身份请求失败:', e && e.message);
        return deny(503, 'AUTH_UNAVAILABLE', '登录状态校验失败，请稍后重试。');
    }
    if (me.status === 401 || me.status === 403) {
        return deny(401, 'SESSION_INVALID', '登录状态已过期，请重新登录后再试。');
    }
    if (!me.ok) {
        console.error('[auth] 校验身份异常:', me.status, String(me.text || '').slice(0, 200));
        return deny(503, 'AUTH_UNAVAILABLE', '登录状态校验失败，请稍后重试。');
    }

    const user = me.json && (me.json.data || me.json.user || me.json);
    const userId = user && (user.id || user.sub);
    if (!userId) {
        return deny(401, 'SESSION_INVALID', '登录状态已过期，请重新登录后再试。');
    }

    // ---- 2. 查该用户的会员记录 ----
    // 用 token 调 rest 接口，RLS 会保证只能读到自己的那一行
    let mem;
    try {
        const url = UPSTREAM + '/.cloud/database/rest/memberships' +
            '?select=vip_type,is_premium,expires_at,trial_start&limit=1';
        mem = await fetchJson(url, token);
    } catch (e) {
        console.error('[auth] 查询会员记录失败:', e && e.message);
        return deny(503, 'AUTH_UNAVAILABLE', '会员状态查询失败，请稍后重试。');
    }
    if (mem.status === 401 || mem.status === 403) {
        return deny(401, 'SESSION_INVALID', '登录状态已过期，请重新登录后再试。');
    }
    if (!mem.ok) {
        console.error('[auth] 查询会员异常:', mem.status, String(mem.text || '').slice(0, 200));
        return deny(503, 'AUTH_UNAVAILABLE', '会员状态查询失败，请稍后重试。');
    }

    const rows = Array.isArray(mem.json) ? mem.json : (mem.json && mem.json.data) || [];
    const row = rows[0] || null;

    // ---- 3. 判定权益 ----
    const now = Date.now();
    if (row) {
        const vipType = row.vip_type || null;
        const isPremiumFlag = row.is_premium === true;
        const isLifetime = vipType === 'lifetime';
        const exp = row.expires_at ? new Date(row.expires_at).getTime() : NaN;
        const premiumValid = isPremiumFlag && (isLifetime || (Number.isFinite(exp) && exp > now));

        if (premiumValid) {
            return { ok: true, status: 200, code: 'OK', message: '', userId, vipType: vipType || 'member' };
        }

        // 试用期（沿用前端同一套口径：trial_start + 7 天）
        const ts = row.trial_start ? new Date(row.trial_start).getTime() : NaN;
        const trialValid = Number.isFinite(ts) && (ts + TRIAL_MS) > now;
        if (trialValid) {
            return { ok: true, status: 200, code: 'OK', message: '', userId, vipType: null };
        }
    }

    return deny(403, 'MEMBERSHIP_REQUIRED', 'AI 功能属于会员权益，你的免费试用已结束或尚未开通。开通后即可继续使用。');
}

module.exports = { requireMember, readToken, UPSTREAM, PUBLISHABLE_KEY, TRIAL_MS };
