(function() {
    'use strict';
    // 「✨ AI帮我复盘」：根据当天规划/时间表统计，自动填写优点、不足、改进措施、待办事项。
    // 仅新增按钮与请求，不改动复盘表单的任何现有结构与逻辑。
    const FILL_FIELDS = [
        ['strengths', '优点'],
        ['weaknesses', '不足'],
        ['improvements', '改进措施'],
        ['todos', '待办事项']
    ];
    const CORE = typeof AIReviewCore !== 'undefined' ? AIReviewCore : (typeof require !== 'undefined' ? require('./ai-review-core') : null);

    function todayStr() {
        const now = new Date();
        return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    }

    // 直接读取时间表原始行（时间+任务+时长）——最可靠的数据源，
    // 不受“未匹配任务名归并进休息放松统计桶”的页面统计行为影响
    function collectSchedule() {
        return [...document.querySelectorAll('#schedule-items .schedule-item')]
            .map(r => {
                const g = sel => { const el = r.querySelector(sel); return el ? el.value : ''; };
                return { time: g('.time-select'), task: String(g('.task-input')).trim(), minutes: parseInt(g('.duration-input'), 10) || 0 };
            })
            .filter(x => x.time && x.task && x.minutes > 0);
    }

    // 收集当天可用数据：已保存的规划、时间表原始行、时间统计、目标达成情况、上次复盘的待办
    function collect() {
        const date = todayStr();
        // 先强制重算一次时间统计，确保拿到的是当前时间表的最新数据；
        // 若图表组件异常导致统计函数中断，保留上一次的统计结果即可，不阻断复盘。
        try { if (typeof updateTimeStatistics === 'function') updateTimeStatistics(); } catch (e) { /* 统计刷新失败不阻断 */ }
        const schedule = collectSchedule();
        let plan = null;
        try {
            const plans = JSON.parse(localStorage.getItem('smart_review_assistant_plans') || '[]');
            plan = (Array.isArray(plans) ? plans : []).find(p => p && p.date === date) || null;
        } catch (e) { plan = null; }

        let lastReview = null;
        try {
            const reviews = typeof getReviews === 'function' ? getReviews()
                : JSON.parse(localStorage.getItem('smart_review_assistant_reviews') || '[]');
            const list = (Array.isArray(reviews) ? reviews : [])
                .filter(r => r && r.date && r.date < date)
                .sort((a, b) => (a.date < b.date ? 1 : -1));
            const found = list.find(r => (r.todos && String(r.todos).trim()) || (r.improvements && String(r.improvements).trim()));
            if (found) lastReview = { date: found.date, todos: found.todos || '', improvements: found.improvements || '' };
        } catch (e) { lastReview = null; }

        const stats = typeof getCurrentTimeStats === 'function' ? getCurrentTimeStats() : null;
        const gp = document.getElementById('goal-progress');
        const gc = document.getElementById('goal-completion');
        const goalCompletion = {
            percentage: gp ? Number(gp.value) : NaN,
            description: gc ? gc.value : ''
        };

        return { date, plan, schedule, currentStats: stats, goalCompletion, lastReview };
    }

    // 是否有足以让 AI 复盘的数据：有规划任务、时间表里有任务行、或已填目标描述。
    // 注意：时间统计会把未匹配的任务名归并进「休息放松」占位桶，不能作为判断依据。
    function hasEnoughData(input) {
        const planHasTasks = input.plan && input.plan.quadrants &&
            ['a', 'b', 'c', 'd'].some(q => Array.isArray(input.plan.quadrants[q]) && input.plan.quadrants[q].some(t => t && String(t.what || '').trim()));
        const scheduleHasTasks = Array.isArray(input.schedule) && input.schedule.length > 0;
        const goalHasDesc = input.goalCompletion && String(input.goalCompletion.description || '').trim().length > 0;
        return Boolean(planHasTasks || scheduleHasTasks || goalHasDesc);
    }

    function notify(message, type) {
        if (typeof showNotification === 'function') showNotification(message, type || 'error');
        else alert(message);
    }

    async function generate(btn) {
        const input = collect();
        if (!CORE) return notify('AI复盘模块未加载完整，请刷新页面重试。');
        if (!hasEnoughData(input)) {
            return notify('AI需要依据今天的数据来复盘：请先填写并保存今日规划，或在时间表中安排任务。', 'error');
        }

        // 已填内容保护：只在覆盖前确认一次
        const hasContent = FILL_FIELDS.some(([id]) => {
            const el = document.getElementById(id);
            return el && el.value.trim();
        });
        if (hasContent && !confirm('AI将覆盖你已填写的优点、不足、改进措施、待办事项，是否继续？')) return;

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'AI复盘生成中…';
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 60000);
        try {
            const response = await fetch('/api/ai-review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify(input)
            });
            const data = await response.json().catch(() => { throw new Error('AI接口不可用，请通过已配置后端的网站访问。'); });
            if (!response.ok) throw new Error(data.error || 'AI复盘失败，请重试。');
            const review = CORE.validate(data);
            FILL_FIELDS.forEach(([id]) => {
                const el = document.getElementById(id);
                if (el) el.value = review[id] || '';
            });
            notify('AI复盘已填入，请检查修改后点击「保存复盘」。', 'success');
        } catch (e) {
            notify(e.name === 'AbortError' ? 'AI生成超时，请重试。' : (e.message || 'AI复盘失败，请重试。'), 'error');
        } finally {
            clearTimeout(timer);
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    function ensureStyle() {
        if (document.getElementById('ai-review-style')) return;
        const style = document.createElement('style');
        style.id = 'ai-review-style';
        style.textContent =
            // 与「AI帮我安排」（.ai-plan-entry）完全同款：紧凑小按钮、纯色、左对齐、位于表单上方
            '.ai-review-entry{border:0;border-radius:8px;padding:10px 18px;margin:0 0 16px;background:#667eea;color:white;cursor:pointer;font:inherit;transition:all .3s ease}' +
            '.ai-review-entry:hover{opacity:.9;transform:translateY(-1px)}' +
            '.ai-review-entry:disabled{opacity:.5;cursor:not-allowed;transform:none}';
        document.head.appendChild(style);
    }

    function init() {
        const form = document.getElementById('review-form');
        if (!form) return;
        if (form.querySelector('.ai-review-entry') || (form.previousElementSibling && form.previousElementSibling.classList && form.previousElementSibling.classList.contains('ai-review-entry'))) return;
        ensureStyle();
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ai-review-entry';
        btn.textContent = '✨ AI帮我复盘';
        // 布局与「AI帮我安排」一致：按钮在表单上方（标题之下），而不是表单底部
        form.before(btn);
        btn.addEventListener('click', () => generate(btn));
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
