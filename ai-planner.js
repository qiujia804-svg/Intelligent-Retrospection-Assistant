(function() {
    'use strict';
    const $ = id => document.getElementById(id);
    let proposal = null, snapshot = '', previousFocus;
    const rows = () => [...document.querySelectorAll('#schedule-items .schedule-item')];
    const readSchedule = () => rows().map(r => ({ time: r.querySelector('.time-select').value, task: r.querySelector('.task-input').value, duration: r.querySelector('.duration-input').value }));
    const fingerprint = () => JSON.stringify({ schedule: readSchedule(), quadrants: [...document.querySelectorAll('#plan-form .task-item input, #plan-form .task-item textarea')].map(e => e.value) });
    const el = (tag, text) => { const n = document.createElement(tag); n.textContent = text; return n; };
    function status(text) { $('ai-plan-status').textContent = text; }
    function invalidate() { proposal = null; $('ai-plan-apply').disabled = true; $('ai-plan-preview').replaceChildren(); }
    function preview(plan) {
        const box = $('ai-plan-preview'); box.replaceChildren();
        const list = el('div', '');
        const names = {a:'重要且紧急',b:'重要不紧急',c:'紧急不重要',d:'不重要不紧急'};
        plan.tasks.forEach(t => {
            const slots = plan.schedule.filter(s => s.taskId === t.id).sort((a,b) => a.time.localeCompare(b.time));
            const card = el('article', '');
            card.append(el('strong', t.what), el('p', `${names[t.quadrant]} · 标签：${t.tag || '未指定'} · ${slots.reduce((n,s)=>n+s.minutes,0)}分钟${t.estimated ? '（AI估算）' : ''}`));
            card.append(el('p', slots.length ? slots.map(s=>`${s.time}（${s.minutes}分钟）`).join('、') : '尚未排入时间表'));
            ['why','how','solution','help'].forEach((k,i) => { if(t[k]) card.append(el('p', `${['重要性','执行方法','解决方案','求助对象'][i]}：${t[k]}`)); });
            list.append(card);
        });
        box.append(list);
        plan.notes.forEach(n => box.append(el('p', `提示：${n}`)));
        const conflicts = AIPlanCore.conflicts(plan, readSchedule());
        if (conflicts.length) {
            box.append(el('strong', '以下时间段已有安排，填入将替换这些内容：'));
            conflicts.forEach(c => box.append(el('p', `${c.time}：${c.before} → ${c.after}`)));
            const label = el('label', ''); const check = document.createElement('input'); check.type='checkbox'; check.id='ai-plan-overwrite';
            label.append(check, document.createTextNode(' 我确认替换上面列出的时间段')); box.append(label);
            check.addEventListener('change', () => { $('ai-plan-apply').disabled = !check.checked; });
        }
        $('ai-plan-apply').disabled = !plan.tasks.length || Boolean(conflicts.length);
    }
    async function generate() {
        invalidate();
        const text = $('ai-plan-input').value.trim();
        if (!text) return status('请先说说今天想做什么。');
        const existing = readSchedule();
        if (!existing.length) return status('时间表尚未加载，请关闭后重试。');
        snapshot = fingerprint();
        $('ai-plan-generate').disabled = true; $('ai-plan-input').disabled = true;
        status('正在生成安排，请稍候……');
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 60000);
        try {
            const response = await fetch('/api/ai-plan', {method:'POST', headers:{'Content-Type':'application/json'}, signal:controller.signal,
                body:JSON.stringify({text, existing, tags: typeof getUserTags === 'function' ? getUserTags().map(t=>t.name) : []})});
            const data = await response.json().catch(()=>{throw new Error('AI接口不可用，请通过已配置后端的网站访问。');});
            if (!response.ok) throw new Error(data.error || '生成失败，请重试。');
            proposal = AIPlanCore.validate(data, existing.map(s=>s.time));
            preview(proposal); status('请检查安排、估算时长和冲突。确认填入后仍可在原表单修改。');
        } catch(e) { invalidate(); status(e.name === 'AbortError' ? '生成超时，请重试。' : e.message); }
        finally { clearTimeout(timer); $('ai-plan-generate').disabled=false; $('ai-plan-input').disabled=false; }
    }
    // 【AI规划同步】把AI使用的标签自动补充进“管理标签”，已存在的标签不重复创建。
    // 标签补齐后，时间分配统计与右侧饼图才能按标签正确归类并显示颜色。
    function ensureAiTags(names) {
        if (typeof getUserTags !== 'function' || typeof saveUserTags !== 'function') return [];
        const existing = getUserTags();
        // 标签体系中“学习”“休息放松”会被永久过滤，无法创建，直接跳过
        const reserved = ['学习', '休息放松'];
        const palette = (typeof TAG_MANAGER_CONFIG === 'object' && TAG_MANAGER_CONFIG && Array.isArray(TAG_MANAGER_CONFIG.presetColors))
            ? TAG_MANAGER_CONFIG.presetColors.map(c => c.value) : [];
        // 生活类标签不分配颜色，与原有标签体系保持一致（不会进入常规时段的下拉菜单）
        const lifeHint = ['洗漱', '晨跑', '做饭', '吃饭', '午休', '午睡', '睡觉', '家务', '冥想', '健身', '运动', '跑步', '散步', '遛狗', '洗澡', '购物', '买菜', '通勤', '早餐', '午餐', '晚餐', '休息', '生活'];
        const created = [];
        [...new Set(names)].forEach(name => {
            const tagName = String(name || '').trim();
            if (!tagName || reserved.includes(tagName)) return;
            if (existing.some(t => t.name === tagName) || created.some(t => t.name === tagName)) return;
            const used = new Set([...existing, ...created].map(t => t.color).filter(Boolean));
            const isLife = lifeHint.some(k => tagName.includes(k));
            const color = isLife ? null : (palette.find(c => !used.has(c)) || (palette.length ? palette[(existing.length + created.length) % palette.length] : null));
            created.push({ id: 'tag_' + Date.now() + '_' + created.length, name: tagName, color: color });
        });
        if (created.length) saveUserTags([...existing, ...created]);
        return created.map(t => t.name);
    }
    function apply() {
        if (!proposal) return;
        if (fingerprint() !== snapshot) { invalidate(); return status('原表单已有变化，请重新生成，避免覆盖刚才的修改。'); }
        const conflicts = AIPlanCore.conflicts(proposal, readSchedule());
        if(conflicts.length && !$('ai-plan-overwrite')?.checked) return;
        const createdTags = ensureAiTags(proposal.tasks.map(t => t.tag));
        // Append new quadrant tasks; preserve every existing task and its event handlers.
        proposal.tasks.forEach(t => {
            const list = document.getElementById(`quadrant-${t.quadrant}`);
            const items = [...list.querySelectorAll('.task-item')];
            if(items.some(i=>i.querySelector('.task-what').value.trim() === t.what.trim())) return;
            let item = items.find(i=>[...i.querySelectorAll('input,textarea')].every(f=>!f.value.trim()));
            if (!item) {
                item = items[0].cloneNode(true);
                item.querySelectorAll('input,textarea').forEach(f=>f.value=''); list.append(item);
                setupAddTaskButton(item.querySelector('.add-task-btn')); setupRemoveTaskButton(item.querySelector('.remove-task-btn'));
            }
            ['what','why','how','solution','help'].forEach(k=>{ item.querySelector(`.task-${k}`).value=t[k]; });
            item.querySelector('.task-what').dispatchEvent(new Event('input',{bubbles:true}));
        });
        proposal.schedule.forEach(s => {
            const row = rows().find(r=>r.querySelector('.time-select').value===s.time);
            const task = proposal.tasks.find(t=>t.id===s.taskId);
            const input = row.querySelector('.task-input'); input.value=task.what;
            row.querySelector('.duration-input').value=s.minutes;
            // 标记该行由AI填入的标签，供时间分配统计/饼图按标签归类（用户手动改动文字后自动失效）
            if (input.dataset) { input.dataset.aiTag = task.tag || ''; input.dataset.aiTagText = task.what; }
            input.dispatchEvent(new Event('input',{bubbles:true}));
            const tag = typeof getUserTags === 'function' ? getUserTags().find(t=>t.name===task.tag) : null;
            if(tag?.color) input.style.borderColor=tag.color;
        });
        updateTimeStatistics();
        if(window.LocalStorageManager) window.LocalStorageManager.manualSave();
        invalidate();
        status(createdTags.length
            ? `已填入原规划和时间表，时间分配图已更新，并自动新增标签：${createdTags.join('、')}。请检查后使用原来的“保存规划”按钮。`
            : '已填入原规划和时间表，时间分配图已更新。请检查后使用原来的“保存规划”按钮。');
    }
    function init() {
        const form = $('plan-form'); if(!form) return;
        const entry=el('button','✨ AI帮我安排'); entry.type='button'; entry.className='ai-plan-entry'; form.before(entry);
        const dialog=document.createElement('dialog'); dialog.id='ai-plan-dialog'; dialog.setAttribute('aria-labelledby','ai-plan-title');
        dialog.innerHTML='<div class="ai-plan-heading"><h2 id="ai-plan-title">说说今天想做什么</h2><button type="button" id="ai-plan-close" aria-label="关闭">×</button></div><p>AI会参考当前时间表生成安排，确认后填入原表单。</p><label for="ai-plan-input">今天的计划</label><textarea id="ai-plan-input" maxlength="4000" rows="5" placeholder="例如：今天制作三个平台的视频，预计一个半小时；11点开始直播三个小时；晚上复盘作品半小时。"></textarea><p class="ai-plan-hint">生成时会将这段文字、当前时间表和标签发送给DeepSeek。时长未说明时会标注AI估算。</p><button type="button" id="ai-plan-generate">生成安排</button><p id="ai-plan-status" role="status" aria-live="polite"></p><div id="ai-plan-preview"></div><button type="button" id="ai-plan-apply" disabled>确认填入原表单</button>';
        document.body.append(dialog);
        entry.addEventListener('click',()=>{previousFocus=document.activeElement;dialog.showModal();$('ai-plan-input').focus();});
        $('ai-plan-close').addEventListener('click',()=>dialog.close());
        dialog.addEventListener('close',()=>previousFocus?.focus());
        $('ai-plan-input').addEventListener('input',invalidate);
        $('ai-plan-generate').addEventListener('click',generate); $('ai-plan-apply').addEventListener('click',apply);
    }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
