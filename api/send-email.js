// Vercel Serverless Function - 邮件发送服务
// 路径: /api/send-email.js
//
// 安全要求：
// 1. SendCloud 凭证必须通过环境变量提供，禁止写死在代码里（会随公开仓库和页面源码泄露）。
//    需要在 Vercel 项目 Settings -> Environment Variables 配置：
//      SENDCLOUD_API_USER
//      SENDCLOUD_API_KEY
// 2. 只允许同源调用，不开放 CORS 给任意站点（否则就是对外开放的邮件群发接口）。
// 3. 做基础限流，防止被刷量消耗邮件额度。注意 Serverless 实例不共享内存，此限流为尽力而为；
//    生产环境建议在 Vercel 前再加一层平台级限流或 WAF 规则。

const https = require('https');
const querystring = require('querystring');

const SENDCLOUD_HOST = 'api.sendcloud.net';
const SENDCLOUD_PATH = '/apiv2/mail/sendtemplate';
const TEMPLATE_NAME = 'verify_code_template';
const OUTBOUND_TIMEOUT_MS = 10000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{6}$/;

// 请求体上限，防止超大 payload
const MAX_BODY_BYTES = 4 * 1024;

// ---- 尽力而为的内存限流 ----
const WINDOW_MS = 10 * 60 * 1000;   // 10 分钟窗口
const MAX_PER_IP = 10;              // 单 IP 窗口内最多 10 次
const MAX_PER_EMAIL = 5;            // 单邮箱窗口内最多 5 次
const hits = new Map();             // key -> [timestamps]

function rateLimit(key, max) {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter(t => now - t < WINDOW_MS);
    if (arr.length >= max) {
        hits.set(key, arr);
        return false;
    }
    arr.push(now);
    hits.set(key, arr);
    // 顺带清理，避免 Map 无限增长
    if (hits.size > 5000) {
        for (const [k, v] of hits) {
            if (v.every(t => now - t >= WINDOW_MS)) hits.delete(k);
        }
    }
    return true;
}

function clientIp(req) {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
    return (req.socket && req.socket.remoteAddress) || 'unknown';
}

// 同源校验：浏览器跨站调用会带 Origin 头，其主机名必须与当前部署主机一致。
// 归一化 www 前缀，避免 www.deepmind.work 与 deepmind.work 互相误判。
function normalizeHost(host) {
    return String(host || '').toLowerCase().replace(/^www\./, '');
}

function isAllowedOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return true;                       // 同源 POST 通常不带 Origin
    try {
        return normalizeHost(new URL(origin).host) === normalizeHost(req.headers.host);
    } catch {
        return false;
    }
}

function setCors(req, res) {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
    if (isAllowedOrigin(req)) {
        // 显式回显同源 Origin，而不是通配符
        const origin = req.headers.origin;
        if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    }
}

module.exports = async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    setCors(req, res);

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    if (!isAllowedOrigin(req)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    const apiUser = process.env.SENDCLOUD_API_USER;
    const apiKey = process.env.SENDCLOUD_API_KEY;
    if (!apiUser || !apiKey) {
        console.error('[send-email] 缺少环境变量 SENDCLOUD_API_USER / SENDCLOUD_API_KEY');
        res.status(503).json({ error: '邮件服务未配置，请在服务器设置 SendCloud 密钥后重试。' });
        return;
    }

    const ip = clientIp(req);
    if (!rateLimit(`ip:${ip}`, MAX_PER_IP)) {
        res.status(429).json({ error: '请求过于频繁，请稍后再试。' });
        return;
    }

    // 读取请求体
    let raw = '';
    let overflow = false;
    for await (const chunk of req) {
        raw += chunk.toString();
        if (raw.length > MAX_BODY_BYTES) { overflow = true; break; }
    }
    if (overflow) {
        res.status(413).json({ error: '请求内容过大' });
        return;
    }

    let body;
    try {
        body = JSON.parse(raw);
    } catch {
        res.status(400).json({ error: 'Invalid JSON' });
        return;
    }

    const { email, verifyCode } = body || {};
    if (typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 254) {
        res.status(400).json({ error: '请输入有效的邮箱地址' });
        return;
    }
    if (typeof verifyCode !== 'string' || !CODE_RE.test(verifyCode)) {
        res.status(400).json({ error: '验证码格式无效' });
        return;
    }

    // 按邮箱限流（放在校验后，避免无效请求污染计数）
    if (!rateLimit(`email:${email.toLowerCase()}`, MAX_PER_EMAIL)) {
        res.status(429).json({ error: '该邮箱发送过于频繁，请 10 分钟后再试。' });
        return;
    }

    const result = await sendEmailViaSendCloud(apiUser, apiKey, email, verifyCode);
    if (result.success) {
        // 成功日志不打印验证码
        console.log(`[send-email] 已向 ${email} 发送验证邮件`);
        res.status(200).json({ success: true, message: 'Email sent successfully' });
    } else {
        console.error('[send-email] SendCloud 返回失败:', result.error);
        res.status(500).json({ error: '邮件发送失败，请稍后重试。' });
    }
};

function sendEmailViaSendCloud(apiUser, apiKey, email, verifyCode) {
    return new Promise((resolve) => {
        const postData = querystring.stringify({
            apiUser,
            apiKey,
            templateInvokeName: TEMPLATE_NAME,
            from: 'noreply@sendcloud.net',
            fromName: '智能复盘助手',
            xsmtpapi: JSON.stringify({
                to: [email],
                sub: {
                    '%name%': ['用户'],
                    '%verify_code%': [verifyCode]
                }
            })
        });

        const options = {
            hostname: SENDCLOUD_HOST,
            port: 443,
            path: SENDCLOUD_PATH,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const request = https.request(options, (response) => {
            let data = '';
            response.on('data', (chunk) => { data += chunk; });
            response.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.statusCode === 200) {
                        resolve({ success: true, result });
                    } else {
                        resolve({ success: false, error: result.message || 'SendCloud API error' });
                    }
                } catch {
                    resolve({ success: false, error: 'Failed to parse SendCloud response' });
                }
            });
        });

        request.setTimeout(OUTBOUND_TIMEOUT_MS, () => {
            request.destroy(new Error('SendCloud request timeout'));
        });
        request.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });

        request.write(postData);
        request.end();
    });
}
