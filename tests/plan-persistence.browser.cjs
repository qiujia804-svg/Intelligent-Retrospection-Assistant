// Run with NODE_PATH pointing to a Playwright installation.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
    const browser = await chromium.launch({ headless: true,
        ...(process.env.TEST_CHROME ? { executablePath: process.env.TEST_CHROME } : {}) });
    try {
        const context = await browser.newContext({ timezoneId: 'Asia/Shanghai', serviceWorkers: 'block' });
        await context.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.pathname === '/api/ai-plan') return route.fulfill({ json: {
                tasks: [{ id:'t1', what:'制作产品视频', why:'推广', how:'写脚本', solution:'', help:'', quadrant:'a', tag:'产品制作', cat:'work', estimated:false }],
                schedule: [{time:'09:00-09:30', taskId:'t1', minutes:30}], notes:[]
            }});
            if (url.hostname !== 'plan.test') return route.fulfill({ contentType:'text/javascript', body:'' });
            const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
            if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status:404 });
            return route.fulfill({ path:file });
        });
        // Chart rendering is external; compare the real application's chart data.
        await context.addInitScript(() => {
            localStorage.setItem('ra_guide_acknowledged', 'true');
            window.Chart = class { constructor(ctx, config) { Object.assign(this, config); } update() {} destroy() {} };
            window.alert = () => {};
        });
        const page = await context.newPage();
        page.setDefaultTimeout(10000);
        page.on('pageerror', error => console.error('page error:', error.message));
        console.log('Loading local application');
        await page.goto('http://plan.test/', {waitUntil:'domcontentloaded'});
        await page.waitForTimeout(1300);
        await page.locator('#splash-screen').waitFor({state:'hidden'});
        await page.evaluate(() => {
            window.AuthState.getState = () => ({status:'signed-in'});
            document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));
            document.getElementById('plan-content').classList.add('active');
            document.querySelector('#quadrant-b .task-what').value = '原有任务';
            const row = [...document.querySelectorAll('#schedule-items .schedule-item')]
                .find(r => r.querySelector('.time-select').value === '08:00-08:30');
            row.querySelector('.task-input').value = '阅读';
            row.querySelector('.duration-input').value = '20';
        });
        await page.getByRole('button', { name:'✨ AI帮我安排', exact:true }).click();
        await page.locator('#ai-plan-input').fill('上午九点制作产品视频，半小时');
        await page.locator('#ai-plan-generate').click();
        console.log('AI preview requested');
        await page.waitForFunction(() => !document.getElementById('ai-plan-apply').disabled);
        await page.locator('#ai-plan-apply').click();
        assert.match(await page.locator('#ai-plan-status').innerText(), /已自动保存/);
        const snapshot = () => page.evaluate(() => ({
            tasks: [...document.querySelectorAll('#quadrant-a .task-what')].map(e => e.value),
            rows: [...document.querySelectorAll('#schedule-items .schedule-item')].map(r => ({
                time:r.querySelector('.time-select').value, task:r.querySelector('.task-input').value,
                duration:r.querySelector('.duration-input').value, data:{...r.querySelector('.task-input').dataset}
            })),
            chart: { labels:timeDistributionChart.data.labels, values:timeDistributionChart.data.datasets[0].data,
                colors:timeDistributionChart.data.datasets[0].backgroundColor }
        }));
        const before = await snapshot();
        assert(before.rows.some(r => r.task === '制作产品视频' && r.data.aiCat === 'work'));
        assert(before.rows.some(r => r.task === '阅读' && r.duration === '20'));
        assert.equal(await page.locator('#quadrant-b .task-what').first().inputValue(), '原有任务');
        await page.reload();
        await page.waitForTimeout(1300);
        assert.deepEqual(await snapshot(), before, 'refresh restores all fields and chart data on default review tab');
        await page.close();
        const reopened = await context.newPage();
        await reopened.goto('http://plan.test/');
        await reopened.waitForTimeout(1300);
        const restored = await reopened.evaluate(() => JSON.parse(localStorage.getItem('smart_review_assistant_plan_draft')));
        assert.equal(restored.schedule.find(s => s.task === '制作产品视频').aiTag, '产品制作');
        assert.equal(await reopened.locator('#schedule-items .task-input').evaluateAll(es => es.filter(e => e.value === '制作产品视频').length), 1);
        // A confirmed plan must also survive removal of temporary drafts.
        await reopened.addInitScript(() => localStorage.removeItem('smart_review_assistant_plan_draft'));
        await reopened.reload();
        await reopened.waitForTimeout(1300);
        assert.equal(await reopened.locator('#schedule-items .task-input').evaluateAll(es => es.filter(e => e.value === '制作产品视频').length), 1);
        // Legacy records have no AI metadata; they must still restore safely.
        await reopened.evaluate(() => {
            const plans = getPlans();
            plans[0].schedule.forEach(s => { delete s.aiTag; delete s.aiTagText; delete s.aiCat; });
            localStorage.setItem('smart_review_assistant_plans', JSON.stringify(plans));
        });
        await reopened.reload();
        await reopened.waitForTimeout(1300);
        assert.equal(await reopened.locator('#schedule-items .task-input').evaluateAll(es => es.filter(e => e.value === '制作产品视频').length), 1);
        console.log('PASS: AI apply, immediate persistence, refresh, reopen, tags/category and chart data');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
