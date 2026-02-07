const http = require('http');
const https = require('https');
const url = require('url');
const querystring = require('querystring');

// SendCloud 配置
const SENDCLOUD_CONFIG = {
    apiUser: 'sc_akjvcr_test_VlAstu',
    apiKey: '82bb08ac6c8d8f56b1e9b0f454e16695',
    templateName: 'verify_code_template'
};

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // 只处理 POST 请求
    if (req.method !== 'POST') {
        res.writeHead(405);
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    
    // 发送邮件接口
    if (parsedUrl.pathname === '/api/send-email') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { email, verifyCode } = data;
                
                if (!email || !verifyCode) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Missing email or verifyCode' }));
                    return;
                }
                
                // 调用 SendCloud API
                console.log('调用 SendCloud API:', { email, verifyCode });
                sendEmailViaSendCloud(email, verifyCode, (error, result) => {
                    if (error) {
                        console.error('SendCloud error:', error);
                        console.error('SendCloud result:', result);
                        res.writeHead(500);
                        res.end(JSON.stringify({ error: 'Failed to send email', details: error, result: result }));
                    } else {
                        console.log('SendCloud success:', result);
                        res.writeHead(200);
                        res.end(JSON.stringify({ success: true, message: 'Email sent successfully' }));
                    }
                });
            } catch (error) {
                console.error('Parse error:', error);
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

// SendCloud 发送邮件函数
function sendEmailViaSendCloud(email, verifyCode, callback) {
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
                    callback(null, result);
                } else {
                    callback(result.message || 'SendCloud API error', null);
                }
            } catch (error) {
                callback('Failed to parse response', null);
            }
        });
    });

    request.on('error', (error) => {
        callback(error.message, null);
    });

    request.write(postData);
    request.end();
}

// 启动服务器
const PORT = 3000;
const HOST = '0.0.0.0'; // 监听所有IP地址
server.listen(PORT, HOST, () => {
    console.log(`Email server running on http://${HOST}:${PORT}`);
    console.log(`API endpoint: http://81.71.18.174:${PORT}/api/send-email`);
});
