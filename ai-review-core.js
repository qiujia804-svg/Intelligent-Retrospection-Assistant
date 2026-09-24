(function(root) {
    'use strict';
    // 复盘的四个填写字段（与 review-form 的 textarea id 一一对应）
    const FIELDS = ['strengths', 'weaknesses', 'improvements', 'todos'];

    // 前端收集到的当天数据 → 发送给 AI 的用户内容（字符串）。
    // 只做纯文本拼接与裁剪，不做语义判断；input 结构见 api/ai-review.js 注释。
    function buildUserContent(input) {
        const safe = v => (typeof v === 'string' ? v : '');
        const parts = {};
        parts.date = safe(input && input.date).slice(0, 20) || '未知日期';

        // 当天已保存的规划（四象限）
        let planText = '';
        const plan = input && input.plan;
        if (plan && typeof plan === 'object' && plan.quadrants) {
            const names = { a: '重要且紧急', b: '重要不紧急', c: '紧急不重要', d: '不重要不紧急' };
            const lines = [];
            for (const q of ['a', 'b', 'c', 'd']) {
                const list = Array.isArray(plan.quadrants[q]) ? plan.quadrants[q] : [];
                list.forEach(t => {
                    if (!t || typeof t !== 'object') return;
                    const what = safe(t.what).trim();
                    if (!what) return;
                    let line = `- [${names[q]}] ${what}`;
                    if (safe(t.why).trim()) line += `（为什么做：${safe(t.why).trim()}）`;
                    if (safe(t.how).trim()) line += `（怎么做：${safe(t.how).trim()}）`;
                    lines.push(line);
                });
            }
            if (lines.length) planText = `今天保存的规划任务：\n${lines.join('\n')}`;
        }

        // 规划里记录的时间分配（保存规划时的统计）
        let planStatsText = statText(plan && plan.timeStats);
        // 当前时间表的实时统计（可能尚未保存）
        let currentStatsText = statText(input && input.currentStats);

        // 当前时间表原始行（时间+任务+时长）：最直接可靠的数据源，
        // 不受“未匹配任务归并进休息放松桶”的统计行为影响
        let scheduleText = '';
        const rows = input && Array.isArray(input.schedule) ? input.schedule : [];
        const lines = [];
        rows.slice(0, 100).forEach(r => {
            if (!r || typeof r !== 'object') return;
            const time = safe(r.time).slice(0, 20);
            const task = safe(r.task).trim().slice(0, 200);
            const minutes = Number(r.minutes);
            if (!time || !task || !Number.isFinite(minutes) || minutes <= 0) return;
            lines.push(`- ${time} ${task}（${minutes}分钟）`);
        });
        if (lines.length) scheduleText = `当前时间表安排：\n${lines.join('\n')}`;

        // 目标达成情况（进度条 + 用户已填描述）
        let goalText = '';
        const goal = input && input.goalCompletion;
        if (goal && typeof goal === 'object') {
            const pct = Number(goal.percentage);
            const desc = safe(goal.description).trim().slice(0, 2000);
            if (Number.isFinite(pct) || desc) {
                goalText = `目标达成情况：${Number.isFinite(pct) ? pct + '%' : '未填写'}`;
                if (desc) goalText += `\n目标描述：${desc}`;
            }
        }

        // 最近一次复盘的待办/改进（用于衔接，而非今天的评价对象）
        let lastText = '';
        const last = input && input.lastReview;
        if (last && typeof last === 'object') {
            const todos = safe(last.todos).trim();
            const imp = safe(last.improvements).trim();
            if (todos || imp) {
                lastText = `上次复盘（${safe(last.date).slice(0, 20)}）：`;
                if (todos) lastText += `\n待办事项：${todos}`;
                if (imp) lastText += `\n改进措施：${imp}`;
            }
        }

        return JSON.stringify({
            date: parts.date,
            plan: planText || '（今天没有保存规划）',
            schedule: scheduleText || '（时间表为空）',
            planTimeStats: planStatsText || '（无）',
            currentTimeStats: currentStatsText || '（无）',
            goalCompletion: goalText || '（未填写）',
            lastReview: lastText || '（无）'
        });
    }

    // 把 timeStats 结构转成可读文本；超过上限时截断，防止请求过大
    function statText(stats) {
        if (!stats || typeof stats !== 'object' || !Array.isArray(stats.items) || !stats.items.length) return '';
        const lines = [];
        if (Number.isFinite(stats.totalMinutes)) lines.push(`总投入：${stats.totalMinutes}分钟`);
        if (Number.isFinite(stats.studyTotalMinutes)) lines.push(`工作/自我提升：${stats.studyTotalMinutes}分钟`);
        if (Number.isFinite(stats.entertainmentTotalMinutes)) lines.push(`娱乐：${stats.entertainmentTotalMinutes}分钟`);
        if (Number.isFinite(stats.lifeTotalMinutes)) lines.push(`生活：${stats.lifeTotalMinutes}分钟`);
        stats.items.slice(0, 40).forEach(item => {
            if (!item || typeof item !== 'object') return;
            const name = String(item.name || '').slice(0, 60);
            const minutes = Number(item.minutes);
            if (!name || !Number.isFinite(minutes) || minutes <= 0) return;
            const cat = ['work', 'life', 'fun', 'rest'].includes(item.cat) ? `（${item.cat}）` : '';
            lines.push(`- ${name}${cat}：${minutes}分钟`);
        });
        return lines.join('\n').slice(0, 4000);
    }

    // 校验 AI 返回内容：四个字段均为 ≤2000 字的字符串，至少一项非空。
    // 通过则返回规范化后的对象（多余字段丢弃），不通过抛出用户可读的错误。
    function validate(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('AI返回的复盘格式无效，请重新生成。');
        const out = {};
        for (const k of FIELDS) {
            const v = data[k];
            if (typeof v !== 'string' || v.length > 2000) throw new Error('AI返回的复盘内容无效，请重新生成。');
            out[k] = v.trim();
        }
        if (!FIELDS.some(k => out[k])) throw new Error('AI未生成任何复盘内容，请重新生成。');
        return out;
    }

    const api = { FIELDS, buildUserContent, validate };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.AIReviewCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
