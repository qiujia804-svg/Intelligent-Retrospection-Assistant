/* Independent time tools. Existing plan rows, saves and full-day pie stay intact. */
window.TimeTools = (() => {
    'use strict';

    const names = { personal: '你能掌控的时间板块', external: '别人掌控你的时间板块', other: '其他时段' };
    const ranges = { personal: [[300,480],[1140,1320]], external: [[540,1080]], other: [[480,540],[1080,1140]] };

    let host, selected = 'all';
    const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) || fallback; } catch (_) { return fallback; } };
    const day = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    function emptyBlocks() {
        return Object.fromEntries(Object.entries(ranges).map(([k, v]) => [k, { totalMinutes: v.reduce((s,[a,b])=>s+b-a,0), workMinutes: 0, recordedMinutes: 0, lifeMinutes: 0, funMinutes: 0, taskCount: 0, typeDurations: {}, rate: 0 }]));
    }
    function addSlot(blocks, slot, duration, work, type = '工作/学习', cat = 'work') {
        const match = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(slot);
        if (!match) return;
        const start = Number(match[1])*60+Number(match[2]);
        const end = Number(match[3])*60+Number(match[4]);
        // A row describes this slot only; overlong entries cannot inflate the rate.
        const usedEnd = Math.min(end, start + Math.max(0, Number(duration)||0));
        for (const [k, rs] of Object.entries(ranges)) {
            const minutes = rs.reduce((s,[a,b])=>s+Math.max(0,Math.min(usedEnd,b)-Math.max(start,a)),0);
            blocks[k].recordedMinutes += minutes;
            if (work) blocks[k].workMinutes += minutes;
            if (minutes > 0) {
                blocks[k].taskCount++;
                blocks[k].typeDurations[type] = (blocks[k].typeDurations[type] || 0) + minutes;
                if (cat === 'life') blocks[k].lifeMinutes += minutes;
                if (cat === 'fun') blocks[k].funMinutes += minutes;
            }
            blocks[k].rate = Math.min(100, Math.round(blocks[k].workMinutes/blocks[k].totalMinutes*1000)/10);
        }
    }
    function renderBlocks(blocks) {
        if (!host) return;
        for (const k of ['personal','external']) {
            host.querySelector(`#tt-rate-${k}`).textContent = `${blocks[k].rate}%`;
            host.querySelector(`#tt-minutes-${k}`).textContent = `工作/学习 ${blocks[k].workMinutes} / ${blocks[k].totalMinutes} 分钟`;
        }
        filterRows();
        if (selected !== 'all') {
            const b = blocks[selected];
            updateTotalStatistics(b.totalMinutes, b.taskCount, b.workMinutes, b.funMinutes, b.lifeMinutes);
            updatePieChart({ ...b.typeDurations, '休息放松': Math.max(0,b.totalMinutes-b.recordedMinutes) }, b.totalMinutes);
        }
        const rate = document.getElementById('tt-active-rate');
        if (rate) rate.textContent = selected === 'all' ? '' : `本板块达成率：${blocks[selected].rate}%（工作/学习时长 ÷ 本板块总时长）`;
    }
    function filterRows() {
        document.querySelectorAll('#schedule-items .schedule-item').forEach(row => {
            const slot = row.querySelector('.time-select')?.value || '';
            const [h,m] = slot.split('-')[0].split(':').map(Number);
            const t = h*60+m;
            row.hidden = selected !== 'all' && !ranges[selected].some(([a,b])=>t>=a && t<b);
        });
    }
    function initViews() {
        const plan = document.getElementById('plan-content');
        const form = document.getElementById('plan-form');
        const entry = plan.querySelector('.ai-plan-entry');
        if (!entry || !form) return;
        const nav = document.createElement('div'); nav.id = 'time-view-nav';
        nav.setAttribute('role','group');nav.setAttribute('aria-label','今日规划功能');
        entry.before(nav); nav.appendChild(entry);
        for (const [view,label] of [['pomodoro','番茄时间'],['personal',names.personal],['external',names.external]]) {
            const button=document.createElement('button');button.type='button';button.dataset.timeView=view;button.textContent=label;nav.appendChild(button);
        }
        const timerPanel=document.createElement('div');timerPanel.id='pomodoro-page';timerPanel.hidden=true;form.before(timerPanel);
        timerPanel.appendChild(host.querySelector('[aria-label="番茄时间"]'));
        window.addEventListener('message',event=>{
            const frame=document.getElementById('pomodoro-frame');
            if(event.origin===location.origin && event.source===frame?.contentWindow && event.data?.type==='pomodoro-height' && Number.isFinite(event.data.height)) frame.style.height=`${Math.max(700,Math.min(5000,event.data.height))}px`;
        });
        host.querySelector('[aria-label="时间板块"]').hidden=true;
        host.hidden=true;
        host=plan;
        const rate=document.createElement('p');rate.id='tt-active-rate';rate.className='tt-help';
        form.querySelector('.time-management > h2').after(rate);
        let activeView='plan';
        function syncMobile() {
            const bar=plan.querySelector('.mtb-bar');
            if (!bar) return;
            bar.hidden=true;
            if (activeView==='plan') {
                const quadrantButton=bar.querySelector('.mtb-item');
                if (quadrantButton && !quadrantButton.classList.contains('active')) quadrantButton.click();
            }
            if (activeView==='personal'||activeView==='external') {
                const timeButton=bar.querySelectorAll('.mtb-item')[1];
                if (timeButton && !timeButton.classList.contains('active')) timeButton.click();
            }
        }
        function open(view) {
            if (!['plan','personal','external','pomodoro'].includes(view)) view='plan';
            const scoped=view==='personal'||view==='external';
            activeView=view;
            selected=scoped?view:'all';
            form.hidden=view==='pomodoro';timerPanel.hidden=view!=='pomodoro';
            form.querySelector('.quadrants').hidden=scoped;
            form.querySelector('.time-management').hidden=!scoped;
            form.querySelector('.time-management > h2').textContent=scoped ? names[view] : '时间管理';
            plan.querySelector(':scope > h2').textContent=view==='plan'?'今日规划（四象限法则）':view==='pomodoro'?'番茄时间':names[view];
            nav.querySelectorAll('[data-time-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.timeView===view)));
            try { localStorage.setItem('ra_time_page_view',JSON.stringify(view)); } catch (_) {}
            syncMobile();
            updateTimeStatistics();
            if (typeof timeDistributionChart !== 'undefined' && timeDistributionChart) requestAnimationFrame(()=>timeDistributionChart.resize());
        }
        nav.querySelectorAll('[data-time-view]').forEach(b=>b.onclick=()=>open(b.dataset.timeView));
        entry.addEventListener('click',()=>open('plan'),true);
        window.addEventListener('resize',syncMobile);
        open(read('ra_time_page_view','plan'));
    }
    function trendDatasets(reviews = []) {
        const records = new Map();
        // The daily plan is the live source for schedule edits after a review was saved.
        for (const k of ['smart_review_assistant_reviews','smart_review_assistant_plans']) {
            const list = read(k, []);
            if (!Array.isArray(list)) continue;
            for (const record of list) if (record.timeStats?.timeBlocks) records.set(String(record.date).split('T')[0], record.timeStats.timeBlocks);
        }
        if (!records.size) return [];
        const datasets = ['personal','external'].map((k,index)=>({ label:names[k], data:Array.from({length:7},(_,i)=>{
            const d=new Date(); d.setDate(d.getDate()-6+i);
            const block = records.get(day(d))?.[k];
            if (block?.recordedMinutes === 0 && block?.taskCount === 0) return null;
            return block?.rate ?? null;
        }), borderColor:index?'#20aa91':'#667eea', backgroundColor:'transparent', borderWidth:3, pointRadius:4, pointBackgroundColor:'#fff', pointBorderWidth:2, tension:0.25, spanGaps:false }));
        datasets[0].label='自主时间';datasets[1].label='工作时间';
        const legacy = Array.from({length:7},(_,i)=>{
            const d=new Date();d.setDate(d.getDate()-6+i);const date=day(d);
            if(records.has(date))return null;
            const r=reviews.find(r=>String(r.date).split('T')[0]===date);
            if(!r)return null;
            const value=typeof r.goalCompletion==='object'?r.goalCompletion?.percentage:parseFloat(r.goalCompletion);
            return Number.isFinite(Number(value))?Math.max(0,Math.min(100,Number(value))):null;
        });
        if(legacy.some(v=>v!==null))datasets.push({label:'历史全天达成率（旧记录）',data:legacy,borderColor:'#94a3b8',borderDash:[5,5],pointRadius:4,spanGaps:false});
        return datasets;
    }
    function calendar() {
        const hour = Number(document.querySelector('input[name="tt-reminder-hour"]:checked')?.value);
        if (hour !== 5 && hour !== 9) return;
        const now = new Date();
        const stamp = now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
        const events = [hour].map(hour => {
            // Encode the Beijing wall-clock time as an explicit UTC instant.
            // Floating DTSTART was interpreted as UTC by some calendar importers (+8 hours).
            const beijing = new Date(now.getTime() + 8 * 60 * 60 * 1000);
            beijing.setUTCHours(hour,0,0,0);
            const start = new Date(beijing.getTime() - 8 * 60 * 60 * 1000);
            if (start <= now) start.setUTCDate(start.getUTCDate()+1);
            const instant = start.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
            const hh=String(hour).padStart(2,'0');
            return ['BEGIN:VEVENT',`UID:deepmind-daily-${hh}-v1@deepmind.work`,`DTSTAMP:${stamp}`,`DTSTART:${instant}`,'RRULE:FREQ=DAILY',`SUMMARY:智能复盘助手·早上${hour}点提醒`,'DESCRIPTION:北京时间到点提醒。打开 https://www.deepmind.work/ 安排今天的时间','BEGIN:VALARM','TRIGGER:PT0S','ACTION:DISPLAY','DESCRIPTION:该安排今天的时间了','END:VALARM','END:VEVENT'].join('\r\n');
        });
        const content=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Deepmind//Daily Reminders//ZH','CALSCALE:GREGORIAN','X-WR-TIMEZONE:Asia/Shanghai',...events,'END:VCALENDAR',''].join('\r\n');
        // iCalendar lines are folded at UTF-8 byte boundaries, not JS character counts.
        const folded=content.split('\r\n').map(line=>{
            let parts=[],part='',bytes=0;
            for(const ch of line){const n=new TextEncoder().encode(ch).length;if(bytes+n>74){parts.push(part);part=' ';bytes=1;}part+=ch;bytes+=n;}parts.push(part);return parts.join('\r\n');
        }).join('\r\n');
        const url=URL.createObjectURL(new Blob([folded],{type:'text/calendar;charset=utf-8'}));
        const a=document.createElement('a');a.href=url;a.download=`智能复盘-早上${hour}点提醒.ics`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
        document.getElementById('tt-calendar-status').textContent=`已下载每天早上${hour}:00（北京时间）的提醒，请导入系统日历并开启通知。如已导入旧提醒或更换时间，请先在日历中删除旧的重复提醒。`;
    }
    function init() {
        host=document.getElementById('time-tools');if(!host)return;
        selected='all';
        host.innerHTML=`<section class="tt-card" aria-label="每日提醒"></section>
        <section class="tt-card" aria-label="时间板块"><h3>分开管理你的时间</h3><div class="tt-blocks"><div class="tt-block">${names.personal}<p class="tt-help">05:00–08:00 · 19:00–22:00</p><strong id="tt-rate-personal">0%</strong><span id="tt-minutes-personal"></span></div><div class="tt-block">${names.external}<p class="tt-help">09:00–18:00</p><strong id="tt-rate-external">0%</strong><span id="tt-minutes-external"></span></div></div><p class="tt-help">达成率 = 本板块工作/学习时长 ÷ 本板块总时长，两类分别计算。生活、娱乐和未安排时段不计为工作/学习；每行最多按该时间段计入。</p><div class="tt-row" role="group" aria-label="显示时间板块"><button type="button" data-block="personal">你能掌控</button><button type="button" data-block="external">别人掌控</button><button type="button" data-block="other">其他时段</button><button type="button" data-block="all">全部时段</button></div><p class="tt-help">下方时间表按所选板块显示；原有饼图仍展示全天分布。其他时段的记录保留。</p></section>
        <section aria-label="番茄时间"><iframe id="pomodoro-frame" title="番茄时间" src="pomodoro.html" style="width:100%;height:1080px;border:0;border-radius:16px;display:block;background:#0a0e14"></iframe></section>`;
        const reminder = host.querySelector('[aria-label="每日提醒"]');
        reminder.innerHTML=`<h3>⏰ 每日定时提醒</h3><p>选择适合你的一个提醒时间（北京时间）</p><p><label><input type="radio" name="tt-reminder-hour" value="5"> 早上5:00 · 我有早起习惯</label></p><p><label><input type="radio" name="tt-reminder-hour" value="9"> 早上9:00 · 我不习惯早起</label></p><button type="button" id="tt-calendar" class="tt-primary">添加所选提醒到系统日历</button><p class="tt-help" id="tt-calendar-status" role="status">只添加所选的一条每日提醒。导入日历并开启系统通知后，关闭网站也可提醒。更换时间或停止提醒，请在日历中删除旧的重复提醒。</p>`;
        const chosenHour = read('ra_daily_reminder_hour',9) === 5 ? 5 : 9;
        reminder.querySelector(`input[value="${chosenHour}"]`).checked=true;
        reminder.querySelectorAll('input[name="tt-reminder-hour"]').forEach(input=>input.onchange=()=>{try{localStorage.setItem('ra_daily_reminder_hour',input.value);}catch(_){}});
        document.getElementById('daily-reminder-tools').appendChild(reminder);
        reminder.querySelector('#tt-calendar').onclick=calendar;
        const select=()=>{filterRows();host.querySelectorAll('[data-block]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.block===selected)));};
        host.querySelectorAll('[data-block]').forEach(b=>b.onclick=()=>{selected=b.dataset.block;localStorage.setItem('ra_time_block_view',JSON.stringify(selected));select();});
        select();initViews();if(typeof updateTimeStatistics==='function')updateTimeStatistics();
    }
    document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));
    return { emptyBlocks, addSlot, renderBlocks, trendDatasets };
})();
