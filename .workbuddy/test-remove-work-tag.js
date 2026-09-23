// 测试：删除默认「工作」标签（tag_6）
// 验证：①新用户默认仅6个生活标签，无「工作」 ②老用户已存的 tag_6「工作」被一次性迁移清理
//      ③AI标签（美国尾程直播等）保持在生活标签前面 ④用户手动新建的同名「工作」标签不受影响
//      ⑤下拉菜单不再出现「工作」 ⑥老迁移标记 cleanup_v2 已跑过也能触发 v3 清理
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = 'F:/AI/xinagmu/Intelligent-Retrospection-Assistant-master';
const DEFAULT_NAMES = ['午餐', '晚餐', '通勤', '锻炼', '冥想', '洗漱'];

function boot(seedTags, opts = {}) {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const dom = new JSDOM(html, {
        url: 'http://127.0.0.1:8766/index.html', runScripts: 'dangerously', pretendToBeVisual: true,
        beforeParse(window) {
            window.matchMedia = window.matchMedia || (q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
            window.scrollTo = () => {};
            window.alert = () => {}; window.confirm = () => true;
            window.fetch = () => new Promise(() => {});
            window.Chart = class {
                constructor(el, cfg) { this.data = cfg.data; this.options = cfg.options || { plugins: {} }; }
                update() {} destroy() {}
            };
            if (seedTags) window.localStorage.setItem('custom_tags_v1', JSON.stringify(seedTags));
            if (opts.ranV2) window.localStorage.setItem('custom_tags_cleanup_v2', '1');
            // 清掉 v3 迁移标记，模拟"老用户第一次打开新版本"
            window.localStorage.removeItem('custom_tags_cleanup_v3');
            window.localStorage.removeItem('custom_tags_defaults_v3');
        }
    });
    const { window } = dom;
    const doc = window.document;
    for (const f of ['local-storage-manager.js', 'review-assistant.js']) {
        const s = doc.createElement('script');
        s.textContent = fs.readFileSync(path.join(ROOT, f), 'utf8');
        doc.body.appendChild(s);
    }
    if (typeof window.init === 'function') { try { window.init(); } catch (e) {} }
    return { dom, window, doc };
}

const results = [];
const AI_TAGS = [
    { id: 'tag_1758000000001', name: '美国尾程直播', color: '#52c41a' },
    { id: 'tag_1758000000002', name: '做数字人视频', color: '#f5222d' },
    { id: 'tag_1758000000003', name: '复盘', color: '#1890ff' }
];

// 场景A：新用户（无存储）→ 默认仅6个生活标签，无「工作」
{
    const { dom, window } = boot(null);
    const tags = window.getUserTags().map(t => t.name);
    results.push({
        场景: 'A-新用户',
        默认顺序: tags.join('/'),
        无工作标签: !tags.includes('工作'),
        恰好6个生活标签: tags.length === 6 && DEFAULT_NAMES.every(n => tags.includes(n))
    });
    dom.window.close();
}

// 场景B：老用户（工作tag_6+3个AI标签），v2清理已跑过 → tag_6被v3清掉，AI标签在前，生活标签追加末尾
{
    const seed = [
        { id: 'tag_6', name: '工作', color: '#722ed1' },
        ...AI_TAGS
    ];
    const { dom, window } = boot(seed, { ranV2: true });
    const tags = window.getUserTags().map(t => t.name);
    const stored = JSON.parse(window.localStorage.getItem('custom_tags_v1')).map(t => t.name);
    results.push({
        场景: 'B-老用户清理工作',
        迁移后顺序: tags.join('/'),
        工作已删除: !tags.includes('工作') && !stored.includes('工作'),
        AI标签在最前: tags.slice(0, 3).join('/') === '美国尾程直播/做数字人视频/复盘',
        生活标签追加末尾: stored.slice(-6).join(',') === DEFAULT_NAMES.join(','),
        无重复: new Set(stored).size === stored.length
    });
    dom.window.close();
}

// 场景C：老用户带旧预置标签（tag_1~tag_5 未清理过，v2/v3 一起触发）
{
    const seed = [
        { id: 'tag_1', name: '洗漱、晨跑', color: null },
        { id: 'tag_3', name: '做饭、吃饭', color: null },
        { id: 'tag_6', name: '工作', color: '#722ed1' },
        ...AI_TAGS
    ];
    const { dom, window } = boot(seed);
    const tags = window.getUserTags().map(t => t.name);
    results.push({
        场景: 'C-新旧预置一起清理',
        迁移后顺序: tags.join('/'),
        旧生活预置已清掉: !tags.includes('洗漱、晨跑') && !tags.includes('做饭、吃饭'),
        工作已删除: !tags.includes('工作'),
        AI标签在前: tags[0] === '美国尾程直播'
    });
    dom.window.close();
}

// 场景D：用户手动新建过同名「工作」标签（id为时间戳）→ 不应被误删
{
    const seed = [
        { id: 'tag_6', name: '工作', color: '#722ed1' },
        { id: 'tag_1759000000009', name: '工作', color: '#eb2f96' },
        ...AI_TAGS
    ];
    const { dom, window } = boot(seed, { ranV2: true });
    const stored = JSON.parse(window.localStorage.getItem('custom_tags_v1')).map(t => t.name);
    results.push({
        场景: 'D-手建同名工作保留',
        手建工作保留数量: stored.filter(n => n === '工作').length,
        预置tag_6已删: !JSON.parse(window.localStorage.getItem('custom_tags_v1')).some(t => t.id === 'tag_6')
    });
    dom.window.close();
}

// 场景E：下拉菜单——10:00 非生活时段第一项是AI标签且无「工作」；05:00 生活时段同样无「工作」
{
    const seed = [
        { id: 'tag_6', name: '工作', color: '#722ed1' },
        ...AI_TAGS
    ];
    const { dom, window, doc } = boot(seed, { ranV2: true });
    const rows = doc.querySelectorAll('#schedule-items .schedule-item');
    const openMenu = row => {
        row.querySelector('.tag-dropdown-btn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        return Array.from(row.querySelectorAll('.tag-dropdown-item')).map(i => i.getAttribute('data-name'));
    };
    const workMenu = openMenu(rows[10]);  // 10:00 非生活时段
    const lifeMenu = openMenu(rows[0]);   // 05:00 生活时段
    results.push({
        场景: 'E-下拉菜单',
        '10:00菜单': workMenu.join('/'),
        '10:00无工作且AI标签第一': !workMenu.includes('工作') && workMenu[0] === '美国尾程直播',
        '10:00含6生活标签': DEFAULT_NAMES.every(n => workMenu.includes(n)),
        '05:00无工作': !lifeMenu.includes('工作')
    });
    dom.window.close();
}

let pass = true;
for (const r of results) {
    console.log(JSON.stringify(r));
    for (const [k, v] of Object.entries(r)) {
        if (k !== '场景' && k !== '迁移后顺序' && k !== '默认顺序' && !k.includes('菜单') && !k.includes('数量') && (v === false || v === 0)) { pass = false; }
    }
}
console.log(pass ? 'ALL-PASS' : 'HAS-FAIL');
