/**
 * 「AI帮我复盘」单元测试：核心校验层 + 服务端接口
 * 运行：node --test tests/ai-review.test.cjs
 */
const test = require('node:test');
const assert = require('node:assert');

const CORE = require('../ai-review-core');

// ---------- ai-review-core.buildUserContent ----------
test('buildUserContent：完整输入包含各部分数据', () => {
    const input = {
        date: '2026-09-24',
        plan: { quadrants: { a: [{ what: '完善网站', why: '今天要上线', how: '先列提纲' }], b: [], c: [], d: [] }, timeStats: { items: [{ name: '软件开发', minutes: 120, cat: 'work' }], totalMinutes: 120, studyTotalMinutes: 120, entertainmentTotalMinutes: 0, lifeTotalMinutes: 0 } },
        schedule: [{ time: '17:00-17:30', task: '直播', minutes: 30 }, { time: '17:30-18:00', task: '直播', minutes: 30 }],
        currentStats: { items: [{ name: '直播', minutes: 90, cat: 'work' }], totalMinutes: 90, studyTotalMinutes: 90, entertainmentTotalMinutes: 0, lifeTotalMinutes: 0 },
        goalCompletion: { percentage: 70, description: '完成了主要任务' },
        lastReview: { date: '2026-09-23', todos: '回复邮件', improvements: '早点睡' }
    };
    const s = CORE.buildUserContent(input);
    const parsed = JSON.parse(s);
    assert.equal(parsed.date, '2026-09-24');
    assert.match(parsed.plan, /完善网站/);
    assert.match(parsed.plan, /重要且紧急/);
    assert.match(parsed.schedule, /17:00-17:30 直播（30分钟）/);
    assert.match(parsed.planTimeStats, /软件开发/);
    assert.match(parsed.currentTimeStats, /直播/);
    assert.match(parsed.goalCompletion, /70%/);
    assert.match(parsed.lastReview, /回复邮件/);
});

test('buildUserContent：schedule 行被清洗（空行/非法行剔除，超长截断）', () => {
    const parsed = JSON.parse(CORE.buildUserContent({
        schedule: [
            { time: '17:00-17:30', task: '  直播  ', minutes: 30 },
            { time: '18:00-18:30', task: '', minutes: 30 },
            { time: '19:00-19:30', task: 'x'.repeat(500), minutes: 30 },
            { time: '', task: '无时间', minutes: 30 },
            { time: '20:00-20:30', task: '零时长', minutes: 0 },
            null,
            'not-an-object'
        ]
    }));
    const lines = parsed.schedule.split('\n').filter(l => l.startsWith('- '));
    assert.equal(lines.length, 2);
    assert.match(lines[0], /^- 17:00-17:30 直播（30分钟）$/);
    assert.ok(lines[1].length <= 240);
});

test('buildUserContent：空输入不抛错，各部分标记为空', () => {
    const parsed = JSON.parse(CORE.buildUserContent({}));
    assert.equal(parsed.plan, '（今天没有保存规划）');
    assert.equal(parsed.planTimeStats, '（无）');
    assert.equal(parsed.currentTimeStats, '（无）');
    assert.equal(parsed.goalCompletion, '（未填写）');
    assert.equal(parsed.lastReview, '（无）');
});

test('buildUserContent：恶意/超长内容被裁剪，不影响输出为合法JSON', () => {
    const long = 'x'.repeat(5000);
    const parsed = JSON.parse(CORE.buildUserContent({
        date: long,
        currentStats: { items: [{ name: long, minutes: 10, cat: 'work' }], totalMinutes: 10 },
        goalCompletion: { percentage: 50, description: long }
    }));
    assert.ok(parsed.date.length <= 20);
    assert.ok(parsed.currentTimeStats.length <= 4000);
    assert.ok(parsed.goalCompletion.length <= 4020);
});

test('buildUserContent：非法类型字段被忽略', () => {
    const parsed = JSON.parse(CORE.buildUserContent({
        plan: 'not-an-object',
        currentStats: { items: 'bad', totalMinutes: 10 },
        lastReview: 42
    }));
    assert.equal(parsed.plan, '（今天没有保存规划）');
    assert.equal(parsed.currentTimeStats, '（无）');
});

// ---------- ai-review-core.validate ----------
test('validate：合法输出通过并裁剪字段', () => {
    const out = CORE.validate({ strengths: '- a', weaknesses: '- b', improvements: '- c', todos: '- d', extra: '丢弃' });
    assert.deepEqual(out, { strengths: '- a', weaknesses: '- b', improvements: '- c', todos: '- d' });
});

test('validate：缺字段/非字符串/超长/全空都抛错', () => {
    assert.throws(() => CORE.validate(null));
    assert.throws(() => CORE.validate([]));
    assert.throws(() => CORE.validate({ strengths: 1, weaknesses: '', improvements: '', todos: '' }));
    assert.throws(() => CORE.validate({ strengths: 'x'.repeat(2001), weaknesses: '', improvements: '', todos: '' }));
    assert.throws(() => CORE.validate({ strengths: '', weaknesses: '  ', improvements: '', todos: '' }));
});

// ---------- api/ai-review.js（桩 fetch） ----------
function makeRes() {
    return {
        statusCode: 200, body: null, headers: {},
        setHeader(k, v) { this.headers[k] = v; },
        status(code) { this.statusCode = code; return this; },
        json(o) { this.body = o; return this; },
        end() { this.ended = true; }
    };
}
function makeReq(body, headers = {}) {
    return { method: 'POST', headers, socket: { remoteAddress: '1.2.3.4' }, body };
}
const ORIGIN = { origin: 'https://www.deepmind.work', host: 'www.deepmind.work' };
const VALID_INPUT = { date: '2026-09-24', schedule: [{ time: '17:00-17:30', task: '直播', minutes: 30 }], currentStats: { items: [{ name: '直播', minutes: 30, cat: 'work' }], totalMinutes: 30 } };
const AI_OK = { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ strengths: '- a', weaknesses: '- b', improvements: '- c', todos: '- d' }) } }] };

test('api：正常请求返回四个字段', async () => {
    const calls = [];
    global.fetch = async (url, opts) => {
        calls.push({ url, body: JSON.parse(opts.body) });
        return { ok: true, json: async () => AI_OK };
    };
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    const handler = require('../api/ai-review');
    const req = makeReq(VALID_INPUT, ORIGIN);
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.strengths, '- a');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.deepseek.com/chat/completions');
    const userContent = JSON.parse(calls[0].body.messages[1].content);
    assert.equal(userContent.date, '2026-09-24');
    delete process.env.DEEPSEEK_API_KEY;
});

test('api：非对象/非法body返回400', async () => {
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    const handler = require('../api/ai-review');
    for (const bad of [null, undefined, 'str', 42, []]) {
        const res = makeRes();
        await handler(makeReq(bad, ORIGIN), res);
        assert.equal(res.statusCode, 400, 'body=' + JSON.stringify(bad));
    }
    delete process.env.DEEPSEEK_API_KEY;
});

test('api：未配置密钥返回503', async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const handler = require('../api/ai-review');
    const res = makeRes();
    await handler(makeReq(VALID_INPUT, ORIGIN), res);
    assert.equal(res.statusCode, 503);
});

test('api：AI输出无效时返回502且错误可读', async () => {
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    global.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: '{"strengths":123}' } }] }) });
    const handler = require('../api/ai-review');
    const res = makeRes();
    await handler(makeReq(VALID_INPUT, ORIGIN), res);
    assert.equal(res.statusCode, 502);
    assert.ok(/复盘/.test(res.body.error));
    delete process.env.DEEPSEEK_API_KEY;
});

test('api：跨站Origin被拒绝', async () => {
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    const handler = require('../api/ai-review');
    const res = makeRes();
    await handler(makeReq(VALID_INPUT, { origin: 'https://evil.example', host: 'www.deepmind.work' }), res);
    assert.equal(res.statusCode, 403);
    delete process.env.DEEPSEEK_API_KEY;
});

test('api：DeepSeek HTTP错误映射为502', async () => {
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    global.fetch = async () => ({ ok: false, status: 429, text: async () => 'rate limited' });
    const handler = require('../api/ai-review');
    const res = makeRes();
    await handler(makeReq(VALID_INPUT, ORIGIN), res);
    assert.equal(res.statusCode, 502);
    assert.match(res.body.error, /繁忙|额度/);
    delete process.env.DEEPSEEK_API_KEY;
});
