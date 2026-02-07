// Vercel Serverless Function - 邮件发送服务
// 路径: /api/send-email.js

const https = require('https');
const querystring = require('querystring');

// SendCloud 配置
const SENDCLOUD_CONFIG = {
    apiUser: 'sc_akjvcr_test_VlAstu',
    apiKey: '82bb08ac6c8d8f56b1e9b0f454e16695',
    templateName: 'verify_code_template'
};

module.exports = async (req, res) => {
    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 只处理 POST 请求
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { email, verifyCode } = req.body;

        if (!email || !verifyCode) {
            res.status(400).json({ error: 'Missing email or verifyCode' });
            return;
        }

        // 调用 SendCloud API 发送邮件
        const result = await sendEmailViaSendCloud(email, verifyCode);
        
        if (result.success) {
            res.status(200).json({ success: true, message: 'Email sent successfully' });
        } else {
            res.status(500).json({ error: result.error || 'Failed to send email' });
        }
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};

// SendCloud 发送邮件函数
function sendEmailViaSendCloud(email, verifyCode) {
    return new Promise((resolve, reject) => {
        const postData = querystring.stringify({
            apiUser: SENDCLOUD_CONFIG.apiUser,
            apiKey: SENDCLOUD_CONFIG.apiKey,
            templateInvokeName: SENDCLOUD_CONFIG.templateName,
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
            response.on('data', (chunk) => {
                data += chunk;
            });
            response.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.statusCode === 200) {
                        resolve({ success: true, result });
                    } else {
                        resolve({ success: false, error: result.message || 'SendCloud API error' });
                    }
                } catch (error) {
                    resolve({ success: false, error: 'Failed to parse response' });
                }
            });
        });

        request.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });

        request.write(postData);
        request.end();
    });
}
