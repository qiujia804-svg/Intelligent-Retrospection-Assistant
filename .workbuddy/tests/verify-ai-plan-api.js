/* 验证 api/ai-plan.js（Vercel 接口）与 server/ai-plan-server.js（自托管适配器）。 */
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const handler = require(path.join(ROOT, 'api/ai-plan.js'));
const core = require(path.join(ROOT, 'ai-plan-core.js'));

const results = [];
const check = (name, cond, extra = '') => { results.push(!!cond); console.log(`${cond ? '✅' : '❌'} ${name}${extra ? '  -> ' + extra : ''}`); };
const makeRes = () => ({ statusCode: 200, headers: {}, body: null,
  setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
  status(c) { this.statusCode = c; return this; },
  json(v) { this.body = v; return this; }, end(v) { this.body = v; } });

let ipSeq = 0;
const req = (body, method = 'POST', opts = {}) => ({
  method,
  headers: {
    host: 'deepmind.work',
    'x-forwarded-for': opts.ip || `10.1.${++ipSeq}.7`,   // 每次调用默认不同 IP，避免限流串扰
    ...(opts.origin ? { origin: opts.origin } : {})
  },
  body
});

const good = { text: '制作视频90分钟，11点直播3小时', tags: ['工作'], existing: [
  { time: '09:00-09:30', task: '', duration: '' }, { time: '11:00-11:30', task: '午休', duration: 30 }] };

async function call(body, method = 'POST', env, opts) {
  delete process.env.DEEPSEEK_API_KEY;
  if (env) Object.assign(process.env, env);
  const res = makeRes();
  await handler(req(body, method, opts), res);
  return res;
}

(async () => {
  console.log('=== A. 接口入参校验 ===');
  let r = await call(null, 'GET');
  check('A1. GET 应 405', r.statusCode === 405, `HTTP ${r.statusCode}`);
  r = await call({ ...good, text: '' });
  check('A2. 空文本应 400', r.statusCode === 400, r.body?.error);
  r = await call({ ...good, text: 'x'.repeat(4001) });
  check('A3. 超 4000 字应 400', r.statusCode === 400, r.body?.error);
  r = await call({ ...good, existing: [{ time: '9:00-9:30', task: '', duration: '' }] });
  check('A4. 非整半小时时段应 400', r.statusCode === 400, r.body?.error);
  r = await call({ ...good, existing: [{ time: '09:00-09:30', task: 'x', duration: 'abc' }] });
  check('A5. 非法 duration 应 400', r.statusCode === 400, r.body?.error);
  r = await call({ ...good, existing: 'notarray' });
  check('A6. existing 非数组应 400', r.statusCode === 400, r.body?.error);
  r = await call(good);
  check('A7. 未配密钥应 503 且提示未配置', r.statusCode === 503 && /尚未配置DeepSeek/.test(r.body?.error), r.body?.error);
  check('A8. 响应设 no-store', r.headers['cache-control'] === 'no-store', String(r.headers['cache-control']));
  r = await call(good, 'OPTIONS');
  check('A9. OPTIONS 预检应 204', r.statusCode === 204, `HTTP ${r.statusCode}`);
  r = await call(good, 'POST', null, { origin: 'https://evil.example' });
  check('A10. 跨站 Origin 应 403', r.statusCode === 403, `HTTP ${r.statusCode} ${r.body?.error}`);
  r = await call(good, 'POST', null, { origin: 'https://www.deepmind.work' });
  check('A11. www/非www 归一化后放行（非403）', r.statusCode !== 403, `HTTP ${r.statusCode}`);
  r = await call(good, 'POST', null, { origin: 'https://deepmind.work.evil.com' });
  check('A12. 后缀伪装域名应 403', r.statusCode === 403, `HTTP ${r.statusCode}`);

  console.log('\n=== B. 真实调用 DeepSeek（伪造密钥，验证失败分支非假成功）===');
  r = await call(good, 'POST', { DEEPSEEK_API_KEY: 'sk-invalid-key-for-verification' });
  check('B1. 密钥无效应 502（真实上游拒绝）', r.statusCode === 502, `HTTP ${r.statusCode} ${r.body?.error}`);
  check('B2. 错误信息不泄露密钥', !JSON.stringify(r.body).includes('sk-invalid'), JSON.stringify(r.body).slice(0, 90));

  console.log('\n=== C. ai-plan-core 结构校验（浏览器侧防线）===');
  const slots = ['09:00-09:30', '09:30-10:00'];
  const T = (id, q = 'a') => ({ id, what: '任务' + id, quadrant: q, why: '', how: '', solution: '', help: '', tag: '', estimated: false });
  const P = (tasks, schedule, notes = []) => ({ tasks, schedule, notes });
  const threw = fn => { try { fn(); return null; } catch (e) { return e.message; } };
  check('C1. 合法结构通过', thrustry(P([T('t1')], [{ time: '09:00-09:30', taskId: 't1', minutes: 30 }])), '');
  function thrustry(p) { try { core.validate(p, slots); return true; } catch { return false; } }
  check('C2. 时长>30 被拒', !!threw(() => core.validate(P([T('t1')], [{ time: '09:00-09:30', taskId: 't1', minutes: 90 }]), slots)));
  check('C3. 时间段越界被拒', !!threw(() => core.validate(P([T('t1')], [{ time: '03:00-03:30', taskId: 't1', minutes: 30 }]), slots)));
  check('C4. 同一时段重复被拒', !!threw(() => core.validate(P([T('t1')], [{ time: '09:00-09:30', taskId: 't1', minutes: 30 }, { time: '09:00-09:30', taskId: 't1', minutes: 30 }]), slots)));
  check('C5. taskId 不存在被拒', !!threw(() => core.validate(P([T('t1')], [{ time: '09:00-09:30', taskId: 't9', minutes: 30 }]), slots)));
  check('C6. 非法象限被拒', !!threw(() => core.validate(P([T('t1', 'x')], [{ time: '09:00-09:30', taskId: 't1', minutes: 30 }]), slots)));
  check('C7. 任务缺 tag 字段被拒（严格）', !!threw(() => { const t = T('t1'); delete t.tag; return core.validate(P([t], [{ time: '09:00-09:30', taskId: 't1', minutes: 30 }]), slots); }), '缺可选字段会整体失败');
  check('C8. 超过 40 个任务被拒', !!threw(() => core.validate(P(Array.from({ length: 41 }, (_, i) => T('t' + i)), [{ time: '09:00-09:30', taskId: 't0', minutes: 30 }]), slots)));
  const cf = core.conflicts(P([T('t1')], [{ time: '11:00-11:30', taskId: 't1', minutes: 30 }]), [{ time: '11:00-11:30', task: '午休', duration: 30 }]);
  check('C9. 冲突检测识别已有安排', cf.length === 1 && cf[0].before === '午休' && cf[0].after === '任务t1', JSON.stringify(cf));
  const cf2 = core.conflicts(P([T('t1')], [{ time: '09:00-09:30', taskId: 't1', minutes: 30 }]), [{ time: '09:00-09:30', task: '', duration: '' }]);
  check('C10. 空时段不误报冲突', cf2.length === 0, JSON.stringify(cf2));

  console.log('\n=== D. 自托管适配器 server/ai-plan-server.js ===');
  const { createServer } = require(path.join(ROOT, 'server/ai-plan-server.js'));
  const server = createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const get = async (p, opts = {}) => { const res = await fetch(base + p, opts); return { status: res.status, text: await res.text() }; };

  delete process.env.DEEPSEEK_API_KEY;
  let h = await get('/api/ai-plan-health');
  check('D1. 健康检查返回 ready:false（无密钥）', h.status === 200 && JSON.parse(h.text).ready === false, h.text);
  process.env.DEEPSEEK_API_KEY = 'sk-x';
  h = await get('/api/ai-plan-health');
  check('D2. 有密钥时 ready:true', JSON.parse(h.text).ready === true, h.text);
  delete process.env.DEEPSEEK_API_KEY;

  let x = await get('/api/ai-plan', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hi' });
  check('D3. 非 JSON 请求应 415', x.status === 415, x.text);
  x = await get('/api/ai-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
  check('D4. 非法 JSON 应 400', x.status === 400, x.text);
  x = await get('/api/ai-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...good, text: 'x'.repeat(70000) }) });
  check('D5. 超大请求体应 413', x.status === 413, x.text);
  x = await get('/api/ai-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(good) });
  check('D6. 无密钥应 503', x.status === 503, x.text);
  x = await get('/api/ai-plan');
  check('D7. GET /api/ai-plan 应 405', x.status === 405, x.text);
  x = await get('/');
  check('D8. 首页可访问', x.status === 200 && /智能复盘|复盘/.test(x.text), `HTTP ${x.status} len=${x.text.length}`);
  x = await get('/ai-planner.js');
  check('D9. 规划脚本可访问', x.status === 200 && x.text.includes('AIPlanCore'), `HTTP ${x.status}`);
  x = await get('/.env.local');
  check('D10. .env.local 拒绝访问', x.status === 404, `HTTP ${x.status}`);
  x = await get('/..%2f.env.local');
  check('D11. 路径穿越被拦', x.status === 404, `HTTP ${x.status}`);
  x = await get('/debug.log');
  check('D12. debug.log 拒绝访问', x.status === 404, `HTTP ${x.status}`);
  const opt = await fetch(base + '/api/ai-plan', { method: 'OPTIONS' });
  check('D13. OPTIONS 预检应 204', opt.status === 204, `HTTP ${opt.status}`);
  server.close();
  await new Promise(r => setTimeout(r, 50));

  console.log('\n=== E. 限流（同 IP 连续生成）===');
  let limited = false, codes = [];
  for (let i = 0; i < 25; i++) {
    const res = await call(good, 'POST', null, { ip: '9.9.9.9' });
    codes.push(res.statusCode);
    if (res.statusCode === 429) { limited = true; break; }
  }
  check('E1. 同 IP 超过 20 次触发 429', limited, `状态序列: ${codes.join(',')}`);
  const afterFlood = await call(good);
  check('E2. 其他 IP 不受影响', afterFlood.statusCode === 503, `HTTP ${afterFlood.statusCode}`);

  console.log(`\n结果：${results.filter(Boolean).length}/${results.length} 项通过`);
  process.exit(results.every(Boolean) ? 0 : 1);
})();
