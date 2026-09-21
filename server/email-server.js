const http = require('http');
const https = require('https');
const url = require('url');
const querystring = require('querystring');

// SendCloud 配置 —— 必须通过环境变量提供，禁止写死（会进公开仓库）。
// 启动前设置：
//   export SENDCLOUD_API_USER='你的apiUser'
//   export SENDCLOUD_API_KEY='你的apiKey'
const SENDCLOUD_API_USER = process.env.SENDCLOUD_API_USER;
const SENDCLOUD_API_KEY = process.env.SENDCLOUD_API_KEY;
const TEMPLATE_NAME = 'verify_code_template';
const OUTBOUND_TIMEOUT_MS = 10000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{6}$/;
const MAX_BODY_BYTES = 4 * 1024;

// 尽力而为的内存限流
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 30;
const MAX_PER_EMAIL = 5;
const hits = new Map();

function rateLimit(key, max) {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter(t => now - t < WINDOW_MS);
    if (arr.length >= max) {
        hits.set(key, arr);
        return false;
    }
    arr.push(now);
    hits.set(key, arr);
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

// 同源校验：本服务应只被自己站点的前端调用。
// 归一化 www 前缀，避免 www.deepmind.work 与 deepmind.work 互相误判。
function normalizeHost(host) {
    return String(host || '').toLowerCase().replace(/^www\./, '');
}

function isAllowedOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return true;
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
    const origin = req.headers.origin;
    if (origin && isAllowedOrigin(req)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
}

function respond(res, status, payload) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
}

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
    setCors(req, res);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method !== 'POST') {
        respond(res, 405, { error: 'Method not allowed' });
        return;
    }

    if (!isAllowedOrigin(req)) {
        respond(res, 403, { error: 'Forbidden' });
        return;
    }

    const parsedUrl = url.parse(req.url, true);

    if (parsedUrl.pathname === '/api/send-email') {
        if (!SENDCLOUD_API_USER || !SENDCLOUD_API_KEY) {
            console.error('[email-server] 缺少环境变量 SENDCLOUD_API_USER / SENDCLOUD_API_KEY');
            respond(res, 503, { error: '邮件服务未配置，请在服务器设置 SendCloud 密钥后重试。' });
            return;
        }

        const ip = clientIp(req);
        if (!rateLimit(`ip:${ip}`, MAX_PER_IP)) {
            respond(res, 429, { error: '请求过于频繁，请稍后再试。' });
            return;
        }

        let body = '';
        let overflow = false;
        req.on('data', chunk => {
            body += chunk.toString();
            if (body.length > MAX_BODY_BYTES) { overflow = true; req.destroy(); }
        });

        req.on('end', () => {
            if (overflow) return; // 连接已被销毁
            let data;
            try {
                data = JSON.parse(body);
            } catch {
                respond(res, 400, { error: 'Invalid JSON' });
                return;
            }

            const { email, verifyCode } = data || {};
            if (typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 254) {
                respond(res, 400, { error: '请输入有效的邮箱地址' });
                return;
            }
            if (typeof verifyCode !== 'string' || !CODE_RE.test(verifyCode)) {
                respond(res, 400, { error: '验证码格式无效' });
                return;
            }

            if (!rateLimit(`email:${email.toLowerCase()}`, MAX_PER_EMAIL)) {
                respond(res, 429, { error: '该邮箱发送过于频繁，请 10 分钟后再试。' });
                return;
            }

            sendEmailViaSendCloud(SENDCLOUD_API_USER, SENDCLOUD_API_KEY, email, verifyCode, (error) => {
                if (error) {
                    console.error('[email-server] SendCloud 失败:', error);
                    respond(res, 500, { error: '邮件发送失败，请稍后重试。' });
                } else {
                    // 成功日志不打印验证码
                    console.log(`[email-server] 已向 ${email} 发送验证邮件`);
                    respond(res, 200, { success: true, message: 'Email sent successfully' });
                }
            });
        });
    } else {
        respond(res, 404, { error: 'Not found' });
    }
});

// SendCloud 发送邮件函数
function sendEmailViaSendCloud(apiUser, apiKey, email, verifyCode, callback) {
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
        hostname: 'api.sendcloud.net',
        port: 443,
        path: '/apiv2/mail/sendtemplate',
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
                    callback(null, result);
                } else {
                    callback(result.message || 'SendCloud API error', null);
                }
            } catch {
                callback('Failed to parse response', null);
            }
        });
    });

    request.setTimeout(OUTBOUND_TIMEOUT_MS, () => {
        request.destroy(new Error('SendCloud request timeout'));
    });
    request.on('error', (error) => {
        callback(error.message, null);
    });

    request.write(postData);
    request.end();
}

// 启动服务器
// 默认监听 0.0.0.0 以兼容直接通过公网 IP:3000 访问的 Windows 部署方式。
// 如果前面有 Nginx 反代（deploy-to-server.sh 的 Linux 部署），建议设置 EMAIL_HOST=127.0.0.1，
// 不把邮件服务直接暴露到公网。
const PORT = process.env.EMAIL_PORT || 3000;
const HOST = process.env.EMAIL_HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
    const ready = Boolean(SENDCLOUD_API_USER && SENDCLOUD_API_KEY);
    console.log(`Email server running on http://${HOST}:${PORT}`);
    console.log(`SendCloud 密钥：${ready ? '已配置' : '未配置（邮件发送将返回 503）'}`);
    if (HOST === '0.0.0.0') {
        console.warn('警告：邮件服务正监听所有网卡（公网可达）。已有按 IP/邮箱的限流与同源校验，');
        console.warn('      但建议生产环境用 Nginx 反代并设置 EMAIL_HOST=127.0.0.1。');
    }
});

module.exports = server;
