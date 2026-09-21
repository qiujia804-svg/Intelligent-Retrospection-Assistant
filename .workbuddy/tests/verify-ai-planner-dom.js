/* 真实 DOM 行为验证：ai-planner.js / ai-plan-core.js 跑在 jsdom 里。
   DOM 取真实 index.html；时间表行按 review-assistant.js 的 createTimeSlot 模板逐字还原。
   只替代网络请求，不替代被验证的逻辑。覆盖 3 个场景：正常填入 / 冲突替换 / 表单变更失效。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// jsdom 装在托管 Node 工作区；也支持用 JSDOM_PATH 覆盖，或本地 node_modules
function loadJsdom() {
  const candidates = [
    process.env.JSDOM_PATH,
    'jsdom',
    'C:/Users/PC/.workbuddy/binaries/node/workspace/node_modules/jsdom'
  ].filter(Boolean);
  for (const c of candidates) { try { return require(c); } catch { /* 继续试下一个 */ } }
  throw new Error('未找到 jsdom。安装：cd C:/Users/PC/.workbuddy/binaries/node/workspace && npm install jsdom');
}
const { JSDOM } = loadJsdom();

const ROOT = path.resolve(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const dom = new JSDOM(read('index.html'), { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
const { document } = window;

const slots = ['09:00-09:30', '09:30-10:00', '11:00-11:30', '11:30-12:00'];
const container = document.getElementById('schedule-items');
container.replaceChildren();
slots.forEach((s, i) => {
  const row = document.createElement('div');
  row.className = 'schedule-item';
  row.innerHTML = `
        <div class="schedule-time"><select class="time-select"><option value="${s}">${s}</option></select></div>
        <div class="schedule-task"><div class="task-input-container">
            <input type="text" class="task-input" value="${i === 2 ? '午休' : ''}" autocomplete="off" />
            <button type="button" class="tag-dropdown-btn">▼</button><div class="tag-dropdown-menu"></div>
        </div></div>
        <div class="schedule-duration"><input type="number" class="duration-input" min="0" max="180" value="${i === 2 ? '30' : ''}" /></div>`;
  container.append(row);
});

let statCalls = 0;
window.setupAddTaskButton = () => {};
window.setupRemoveTaskButton = () => {};
window.updateTimeStatistics = () => { statCalls++; };
window.getUserTags = () => [{ name: '工作', color: '#722ed1' }];
window.LocalStorageManager = { manualSave() { window.__saved = (window.__saved || 0) + 1; } };
window.alert = () => {};

let nextPlan = null;
window.fetch = async () => ({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(nextPlan)) });

if (!window.HTMLDialogElement || !window.HTMLDialogElement.prototype.showModal) {
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
}

const ctx = vm.createContext(window);
vm.runInContext(read('ai-plan-core.js'), ctx, { filename: 'ai-plan-core.js' });
vm.runInContext(read('ai-planner.js'), ctx, { filename: 'ai-planner.js' });

const results = [];
const check = (name, cond, extra = '') => { results.push(!!cond); console.log(`${cond ? '✅' : '❌'} ${name}${extra ? '  -> ' + extra : ''}`); };
const $ = id => document.getElementById(id);
const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const type = (el, v) => { el.value = v; el.dispatchEvent(new window.Event('input', { bubbles: true })); };
const gen = async () => { click($('ai-plan-generate')); await new Promise(r => setTimeout(r, 30)); };

const mkPlan = (what, quadrant, time) => ({
  tasks: [{ id: 't1', what, quadrant, why: '原因', how: '方法', solution: '', help: '', tag: '工作', estimated: true }],
  schedule: [{ time, taskId: 't1', minutes: 30 }], notes: ['时长由AI估算']
});

(async () => {
  if (document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
  await new Promise(r => setTimeout(r, 50));

  const entry = document.querySelector('.ai-plan-entry');
  check('1. 页面出现「✨ AI帮我安排」按钮', entry && entry.textContent.includes('AI帮我安排'));
  check('2. 弹窗注入且有 aria 标题', !!$('ai-plan-dialog') && !!$('ai-plan-title'));
  click(entry);
  check('3. 点击后弹窗打开', $('ai-plan-dialog').open === true);

  // ---------- 场景一：正常填入 ----------
  console.log('\n[场景一] 正常填入');
  nextPlan = mkPlan('制作视频', 'b', '11:30-12:00');
  type($('ai-plan-input'), '今天制作视频，预计一个半小时；11点开始直播三个小时');
  await gen();
  check('4. 生成后提示检查', /请检查安排/.test($('ai-plan-status').textContent), $('ai-plan-status').textContent);
  check('5. 预览含任务名/象限/时长', /制作视频/.test($('ai-plan-preview').textContent) && /重要不紧急/.test($('ai-plan-preview').textContent));
  check('6. 无冲突时确认按钮可用', $('ai-plan-apply').disabled === false);
  click($('ai-plan-apply'));
  const filled = [...document.getElementById('quadrant-b').querySelectorAll('.task-what')].map(i => i.value).filter(Boolean);
  check('7. 四象限填入任务', filled.includes('制作视频'), JSON.stringify(filled));
  const r = [...document.querySelectorAll('#schedule-items .schedule-item')].find(x => x.querySelector('.time-select').value === '11:30-12:00');
  check('8. 时间表填入任务+时长', r.querySelector('.task-input').value === '制作视频' && r.querySelector('.duration-input').value === '30');
  check('9. 触发原站统计更新', statCalls > 0, `${statCalls} 次`);
  check('10. 触发本地保存', (window.__saved || 0) > 0, `${window.__saved || 0} 次`);
  check('11. 未涉及时段保持原样', document.querySelector('#schedule-items .task-input').value === '');
  check('12. 原「午休」安排保留', [...document.querySelectorAll('#schedule-items .task-input')].some(i => i.value === '午休'));

  // ---------- 场景二：冲突替换 ----------
  console.log('\n[场景二] 冲突需确认');
  nextPlan = mkPlan('客户沟通', 'a', '11:00-11:30');   // 该时段已有「午休」
  type($('ai-plan-input'), '上午11点跟客户沟通半小时');
  await gen();
  const pv = $('ai-plan-preview').textContent;
  check('13. 显示替换清单', /已有安排，填入将替换/.test(pv) && /午休/.test(pv), pv.replace(/\n/g, ' ').slice(-70));
  check('14. 未勾选时确认按钮禁用', $('ai-plan-apply').disabled === true);
  check('15. 出现确认勾选框', !!$('ai-plan-overwrite'));
  const before = [...document.querySelectorAll('#schedule-items .task-input')].map(i => i.value);
  click($('ai-plan-apply'));
  const after = [...document.querySelectorAll('#schedule-items .task-input')].map(i => i.value);
  check('16. 未勾选时点击不覆盖原有安排', JSON.stringify(before) === JSON.stringify(after), after.join('|'));
  $('ai-plan-overwrite').checked = true;
  $('ai-plan-overwrite').dispatchEvent(new window.Event('change', { bubbles: true }));
  check('17. 勾选后确认按钮可用', $('ai-plan-apply').disabled === false);
  click($('ai-plan-apply'));
  const r2 = [...document.querySelectorAll('#schedule-items .schedule-item')].find(x => x.querySelector('.time-select').value === '11:00-11:30');
  check('18. 勾选后成功覆盖', r2.querySelector('.task-input').value === '客户沟通', r2.querySelector('.task-input').value);
  check('19. 四象限 A 类填入任务', [...document.getElementById('quadrant-a').querySelectorAll('.task-what')].some(i => i.value === '客户沟通'));

  // ---------- 场景三：原表单变更后失效 ----------
  console.log('\n[场景三] 生成后修改原表单');
  nextPlan = mkPlan('复盘作品', 'd', '09:00-09:30');
  type($('ai-plan-input'), '晚上复盘作品半小时');
  await gen();
  check('20. 生成后确认按钮可用', $('ai-plan-apply').disabled === false);
  const guard = document.querySelector('#quadrant-c .task-what');
  type(guard, '我手动加的任务');
  click($('ai-plan-apply'));
  check('21. 检测到表单变化并拒绝覆盖', /原表单已有变化/.test($('ai-plan-status').textContent), $('ai-plan-status').textContent);
  const r3 = document.querySelector('#schedule-items .schedule-item');
  check('22. 变更后未写入 09:00 时段', r3.querySelector('.task-input').value === '', JSON.stringify(r3.querySelector('.task-input').value));
  check('23. 手动内容未被破坏', document.querySelector('#quadrant-c .task-what').value === '我手动加的任务');

  console.log(`\n结果：${results.filter(Boolean).length}/${results.length} 项通过`);
  process.exit(results.every(Boolean) ? 0 : 1);
})();
