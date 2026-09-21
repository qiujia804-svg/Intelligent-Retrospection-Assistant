(function(root) {
    'use strict';
    function validate(plan, slots) {
        if (!plan || !Array.isArray(plan.tasks) || !Array.isArray(plan.schedule) || !Array.isArray(plan.notes)) throw new Error('AI返回的安排格式不完整，请重新生成。');
        if (plan.tasks.length > 40 || plan.schedule.length > 100 || plan.notes.length > 20) throw new Error('安排过多，请分批规划。');
        const text = (v, max = 500) => typeof v === 'string' && v.length <= max;
        const ids = new Set();
        for (const t of plan.tasks) {
            if (!text(t.id, 40) || !t.id || ids.has(t.id) || !text(t.what, 120) || !t.what.trim() || !['a','b','c','d'].includes(t.quadrant) || !['why','how','solution','help','tag'].every(k => text(t[k])) || typeof t.estimated !== 'boolean') throw new Error('AI任务信息无效，请重新生成。');
            ids.add(t.id);
        }
        const seen = new Set();
        for (const s of plan.schedule) {
            if (!ids.has(s.taskId) || !slots.includes(s.time) || seen.has(s.time) || !Number.isInteger(s.minutes) || s.minutes < 1 || s.minutes > 30) throw new Error('AI时间安排有重复、越界或无效时长，请重新生成。');
            seen.add(s.time);
        }
        if (!plan.notes.every(n => text(n))) throw new Error('AI提示格式无效。');
        return plan;
    }
    function conflicts(plan, existing) {
        return plan.schedule.flatMap(s => {
            const old = existing.find(r => r.time === s.time);
            const task = plan.tasks.find(t => t.id === s.taskId);
            return old && old.task.trim() && (old.task !== task.what || Number(old.duration) !== s.minutes) ? [{ time: s.time, before: old.task, after: task.what }] : [];
        });
    }
    const api = { validate, conflicts };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.AIPlanCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
