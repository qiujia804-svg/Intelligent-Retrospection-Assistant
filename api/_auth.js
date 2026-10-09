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

/**
 * 试用期每日 AI 调用上限（正式会员不受限）。
 * 试用的每一次 AI 调用都由我们向大模型付费，不设上限等于把额度敞口交给脚本。
 * 默认 10 次/天：足够真实用户体验出价值，又不至于被刷爆。
 * 可用环境变量 TRIAL_DAILY_LIMIT 覆盖（部署平台改配置即可，不必改代码）。
 */
const TRIAL_DAILY_LIMIT = (() => {
    const n = Number(process.env.TRIAL_DAILY_LIMIT);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
})();

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
async function fetchJson(url, token, opts) {
    const o = opts || {};
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
        if (o.body !== undefined) {
            headers['Content-Type'] = 'application/json';
            headers['Prefer'] = 'return=representation';
        }
        const init = { method: o.method || 'GET', headers, signal: controller.signal };
        if (o.body !== undefined) init.body = JSON.stringify(o.body);
        const res = await fetch(url, init);
        const text = await res.text();
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { /* 非 JSON，保持 null */ }
        return { status: res.status, ok: res.ok, json: json, text: text };
    } finally {
        clearTimeout(timer);
    }
}

/** 当前北京日期（YYYY-MM-DD）。用固定时区，避免 Serverless 的 UTC 环境在凌晨算错"今天" */
function beijingDate() {
    return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * 试用期每日额度自增。
 * 设计原则：**只拦滥用，绝不误伤**——任何一步失败都放行（fail-open），
 * 宁可少数几次额度统计不准，也不能因为限流组件抖动把正常用户挡在门外。
 * @returns {Promise<{allowed:boolean, used:number, limit:number}>}
 */
async function consumeTrialQuota(userId, token) {
    const limit = TRIAL_DAILY_LIMIT;
    const day = beijingDate();
    const base = UPSTREAM + '/.cloud/database/rest/ai_usage';
    const filter = 'owner_id=eq.' + encodeURIComponent(userId) + '&usage_date=eq.' + day;
    try {
        const cur = await fetchJson(base + '?select=used_count&' + filter + '&limit=1', token);
        if (!cur.ok) {
            console.warn('[auth] 额度查询失败，放行:', cur.status, String(cur.text || '').slice(0, 160));
            return { allowed: true, used: 0, limit: limit };
        }
        const rows = Array.isArray(cur.json) ? cur.json : (cur.json && cur.json.data) || [];
        const used = rows.length ? (Number(rows[0].used_count) || 0) : 0;

        if (used >= limit) {
            return { allowed: false, used: used, limit: limit };
        }

        if (rows.length === 0) {
            // 当日首调用：建行。并发下可能撞主键（409），那说明已被别人建过，照常放行。
            const ins = await fetchJson(base, token, {
                method: 'POST',
                body: { owner_id: userId, usage_date: day, used_count: 1 }
            });
            if (!ins.ok && ins.status !== 409) {
                console.warn('[auth] 额度初始化失败，放行:', ins.status, String(ins.text || '').slice(0, 160));
            }
            return { allowed: true, used: 1, limit: limit };
        }

        // 乐观自增：条件带上读到的旧值，避免并发互相覆盖
        const upd = await fetchJson(base + '?' + filter + '&used_count=eq.' + used, token, {
            method: 'PATCH',
            body: { used_count: used + 1 }
        });
        if (!upd.ok) {
            console.warn('[auth] 额度自增失败，放行:', upd.status, String(upd.text || '').slice(0, 160));
        }
        return { allowed: true, used: used + 1, limit: limit };
    } catch (e) {
        console.warn('[auth] 额度校验异常，放行:', e && e.message);
        return { allowed: true, used: 0, limit: limit };
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

    // ---- 2.5 尚无试用记录：服务端补建，让新用户从此刻起算 7 天 ----
    // 前端登录时也会建（cloud-member.js），但注册后立刻点 AI 可能撞上竞态：
    // 那时若直接拒绝，新用户第一眼看到的是「试用已结束」，转化当场就丢了。
    // memberships 的 INSERT 策略允许用户写自己那行（且强制 is_premium=false），
    // 所以这里用他自己的 token 建，仍然受 RLS 约束、拿不到任何额外权限。
    if (!row) {
        try {
            await fetchJson(UPSTREAM + '/.cloud/database/rest/memberships', token, {
                method: 'POST',
                body: {}
            });
        } catch (e) {
            console.warn('[auth] 补建试用记录失败:', e && e.message);
        }
        const q = await consumeTrialQuota(userId, token);
        if (!q.allowed) {
            return deny(403, 'TRIAL_QUOTA_EXCEEDED',
                '今天的免费试用额度已用完（每日 ' + q.limit + ' 次）。开通会员后可不限次使用 AI 功能。');
        }
        return { ok: true, status: 200, code: 'OK', message: '', userId, vipType: null, trialUsed: q.used, trialLimit: q.limit };
    }

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
            // 试用有额度上限；返回 403 而非 429，前端会直接弹出会员中心引导开通
            const quota = await consumeTrialQuota(userId, token);
            if (!quota.allowed) {
                return deny(403, 'TRIAL_QUOTA_EXCEEDED',
                    '今天的免费试用额度已用完（每日 ' + quota.limit + ' 次）。开通会员后可不限次使用 AI 功能。');
            }
            return { ok: true, status: 200, code: 'OK', message: '', userId, vipType: null, trialUsed: quota.used, trialLimit: quota.limit };
        }
    }

    return deny(403, 'MEMBERSHIP_REQUIRED', 'AI 功能属于会员权益，你的免费试用已结束或尚未开通。开通后即可继续使用。');
}

module.exports = { requireMember, readToken, UPSTREAM, PUBLISHABLE_KEY, TRIAL_MS };
