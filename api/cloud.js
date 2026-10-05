/**
 * Vercel Serverless - WorkBuddy 云服务同源代理
 * 对外路径: /cb/*   （vercel.json: /cb/(.*) → /api/cloud）
 *
 * 为什么用 /cb 而不是 /api/cloud：
 *   实测确认 Vercel 的 rewrites 规则对 /api/* 前缀完全不生效——
 *   /api/cloud/a 单级能进函数，/api/cloud/a/b 多级必被平台层 404。
 *   于是改用非 api 前缀 /cb，让 rewrite 正常生效：
 *     浏览器 /cb/.cloud/auth/v1/otp
 *       → rewrite → api/cloud.js（req.url 保留 /cb/... 原始路径）
 *       → 本函数转发到云端 /.cloud/auth/v1/otp
 *
 * 背景：WorkBuddy 云端强制校验请求 Origin（精确匹配应用注册域名），
 * 本站部署在自定义域名 www.deepmind.work，浏览器直连会被 CORS 预检 403。
 * 解法：浏览器 → 同源 /cb/*（无跨域）→ 本函数（服务端）→ 云端。
 * 服务端转发时把 Origin 设为云端注册域名，绕开浏览器的限制。
 *
 * 安全：仅允许同源调用（Origin 主机与请求主机一致），不做开放中继。
 * 透传：方法、Authorization、Content-Type、Prefer、Range 等业务头；
 *      不透传 cookie / host / 浏览器自动头；剥离 hop-by-hop 响应头。
 */

const UPSTREAM = 'https://smart-review-09187.app.workbuddy.host';
const REGISTERED_ORIGIN = 'https://smart-review-09187.app.workbuddy.host';

// 不透传的请求头（由代理自己决定或属于传输层）
const HOP_REQ = new Set([
    'host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade',
    'content-length', 'origin', 'referer', 'cookie', 'accept-encoding',
    'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-real-ip',
    'x-vercel-id', 'x-vercel-deployment-url', 'x-vercel-forwarded-for'
]);

// 不透传的响应头（fetch 已自动解压，长度会变）
const HOP_RES = new Set([
    'connection', 'keep-alive', 'transfer-encoding', 'content-encoding',
    'content-length', 'access-control-allow-origin', 'access-control-allow-credentials',
    'access-control-allow-headers', 'access-control-allow-methods', 'vary'
]);

function normalizeHost(h) {
    return String(h || '').toLowerCase().replace(/^www\./, '');
}

function isAllowedOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return true; // 同源 POST 一般不带 Origin
    try {
        return normalizeHost(new URL(origin).host) === normalizeHost(req.headers.host);
    } catch (e) {
        return false;
    }
}

// 从常见代理头里取原始 URL（Vercel rewrite 后可能改变 req.url）
function originalUrlFromReq(req) {
    const h = req.headers || {};
    return h['x-original-url'] || h['x-rewrite-url'] || h['x-forwarded-uri'] || req.originalUrl || '';
}

module.exports = async (req, res) => {
    try {
        // 同源校验：防止被当成开放中继滥用
        if (!isAllowedOrigin(req)) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        // 计算上游路径。兼容两种前缀：
        //   /cb/xxx        （vercel.json rewrite /cb/(.*) → /api/cloud 后的原始 URL）
        //   /api/cloud/xxx （直连本函数时的 URL）
        // 另外兜底：若 Vercel 把 req.url 改写成了 /api/cloud 本身，
        // 则从 x-original-url / 自定义头里取原始路径。
        const rawUrl = req.url || '';
        const original = originalUrlFromReq(req);
        let upstreamPath = '';
        for (const candidate of [rawUrl, original]) {
            const p = String(candidate || '')
                .replace(/^\/cb/, '')
                .replace(/^\/api\/cloud/, '');
            if (p.startsWith('/.cloud/')) { upstreamPath = p; break; }
        }
        if (!upstreamPath) {
            res.status(404).json({ error: 'Not found' });
            return;
        }

        // 组装上游请求头
        const headers = {};
        for (const k of Object.keys(req.headers || {})) {
            const lk = k.toLowerCase();
            if (HOP_REQ.has(lk)) continue;
            headers[k] = req.headers[k];
        }
        headers['origin'] = REGISTERED_ORIGIN;
        if (headers['accept-encoding']) headers['accept-encoding'] = 'identity';

        // 读完整请求体
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const body = Buffer.concat(chunks);
        if (body.length) headers['content-length'] = String(body.length);

        const method = (req.method || 'GET').toUpperCase();
        const hasBody = !['GET', 'HEAD'].includes(method);

        const upstream = await fetch(UPSTREAM + upstreamPath, {
            method: method,
            headers: headers,
            body: hasBody ? body : undefined,
            redirect: 'manual'
        });

        // 回写响应（剥 hop-by-hop 与 CORS 头——同源响应不需要 CORS）
        res.status(upstream.status);
        upstream.headers.forEach((v, k) => {
            const lk = k.toLowerCase();
            if (HOP_RES.has(lk)) return;
            try { res.setHeader(k, v); } catch (e) { /* 个别受限头忽略 */ }
        });
        const buf = Buffer.from(await upstream.arrayBuffer());
        res.send(buf);
    } catch (e) {
        console.error('[cloud-proxy] 转发失败:', e && e.message);
        if (!res.writableEnded) {
            res.status(502).json({ error: '云服务转发失败，请稍后重试。' });
        }
    }
};
