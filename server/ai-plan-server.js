'use strict';
// Standalone adapter for the same handler used by Vercel. No npm dependencies.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
// 本地开发时读取项目根目录的 .env.local；生产环境优先使用服务器已设置的环境变量。
const envFile = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match || process.env[match[1]]) continue;
        process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
}
const handler = require('../api/ai-plan');
const root = path.resolve(__dirname, '..');
const publicFiles = new Set([
    'index.html', 'review-assistant.js', 'review-assistant.css', 'mobile.css',
    'ai-plan-core.js', 'ai-planner.js', 'ai-planner.css', 'data-storage.js',
    'local-storage-manager.js', 'local-storage-ui.js', 'import-for-browser.js',
    'commercial-system.js', 'manifest.json', 'service-worker.js', 'offline.html',
    'robots.txt', 'sitemap.xml'
]);
const mime = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp'};
function createServer() {
    return http.createServer(async (req, res) => {
        res.status = code => { res.statusCode = code; return res; };
        res.json = value => { res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(JSON.stringify(value)); };
        res.setHeader('X-Content-Type-Options','nosniff');
        let pathname;
        try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
        catch { return res.status(400).json({error:'请求地址无效。'}); }
        if(pathname === '/api/ai-plan') {
            if(req.method !== 'POST') return handler(req,res);
            if(!(req.headers['content-type'] || '').startsWith('application/json')) return res.status(415).json({error:'请发送JSON格式的请求。'});
            let bytes=0; const chunks=[];
            try {
                for await(const chunk of req) {
                    bytes += chunk.length;
                    if(bytes > 65536) { res.status(413).json({error:'计划内容过长，请缩短后重试。'}); return; }
                    chunks.push(chunk);
                }
                req.body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            } catch { return res.status(400).json({error:'请求内容格式无效。'}); }
            try { await handler(req,res); }
            catch { if(!res.writableEnded) res.status(500).json({error:'服务暂时不可用，请稍后重试。'}); }
            return;
        }
        if(pathname === '/api/ai-plan-health' && req.method === 'GET') {
            res.setHeader('Cache-Control','no-store');
            return res.json({ready:Boolean(process.env.DEEPSEEK_API_KEY)});
        }
        if(!['GET','HEAD'].includes(req.method)) return res.status(405).json({error:'不支持此请求方法。'});
        const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
        const asset = /^(icons|images)\/[a-zA-Z0-9_./ -]+\.(png|jpe?g|svg|ico|webp)$/i.test(relative);
        const file = path.resolve(root,relative);
        if((!publicFiles.has(relative) && !asset) || !file.startsWith(root+path.sep)) return res.status(404).json({error:'页面不存在。'});
        try {
            if(!fs.statSync(file).isFile()) throw new Error();
            res.setHeader('Content-Type',mime[path.extname(file)] || 'text/plain; charset=utf-8');
            res.setHeader('Cache-Control','no-cache');
            if(req.method === 'HEAD') return res.end();
            const stream = fs.createReadStream(file);
            stream.on('error',()=>res.destroy()); stream.pipe(res);
        } catch { res.status(404).json({error:'文件不存在。'}); }
    });
}
if(require.main === module) {
    const port = Number(process.env.AI_PLAN_PORT || 3100);
    const server = createServer();
    server.listen(port, '127.0.0.1',()=>console.log(`AI规划服务：http://127.0.0.1:${port}（${process.env.DEEPSEEK_API_KEY ? '密钥已配置' : '尚未配置密钥'}）`));
}
module.exports = { createServer };
