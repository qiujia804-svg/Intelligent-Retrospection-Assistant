/* Independent time tools. Existing plan rows, saves and full-day pie stay intact. */
window.TimeTools = (() => {
    'use strict';
    const key = 'ra_pomodoro_v1';
    const names = { personal: '你能掌控的时间板块', external: '别人掌控你的时间板块', other: '其他时段' };
    const ranges = { personal: [[300,510],[1140,1320]], external: [[540,1080]], other: [[510,540],[1080,1140]] };
    const modeNames = { focus: '专注', short: '短休', long: '长休' };
    let host, state, audio, selected = 'personal';
    const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) || fallback; } catch (_) { return fallback; } };
    const day = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    function emptyBlocks() {
        return Object.fromEntries(Object.entries(ranges).map(([k, v]) => [k, { totalMinutes: v.reduce((s,[a,b])=>s+b-a,0), workMinutes: 0, recordedMinutes: 0, rate: 0 }]));
    }
    function addSlot(blocks, slot, duration, work) {
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
    }
    function filterRows() {
        document.querySelectorAll('#schedule-items .schedule-item').forEach(row => {
            const slot = row.querySelector('.time-select')?.value || '';
            const [h,m] = slot.split('-')[0].split(':').map(Number);
            const t = h*60+m;
            row.hidden = selected !== 'all' && !ranges[selected].some(([a,b])=>t>=a && t<b);
        });
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
            return records.get(day(d))?.[k]?.rate ?? null;
        }), borderColor:index?'#28a68c':'#667eea', backgroundColor:'transparent', borderWidth:3, pointRadius:4, tension:0.2, spanGaps:false }));
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
        const now = new Date();
        const stamp = now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
        const events = [5,9].map(hour => {
            const start = new Date(now); start.setHours(hour,0,0,0);
            if (start <= now) start.setDate(start.getDate()+1);
            const date = day(start).replace(/-/g,'');
            const hh=String(hour).padStart(2,'0');
            return ['BEGIN:VEVENT',`UID:deepmind-daily-${hh}-v1@deepmind.work`,`DTSTAMP:${stamp}`,`DTSTART:${date}T${hh}0000`,`DTEND:${date}T${hh}0500`,'RRULE:FREQ=DAILY',`SUMMARY:智能复盘助手·${hour===5?'晨间规划':'工作规划'}`,'DESCRIPTION:打开 https://www.deepmind.work/ 安排今天的时间','BEGIN:VALARM','TRIGGER:PT0S','ACTION:DISPLAY','DESCRIPTION:该安排今天的时间了','END:VALARM','END:VEVENT'].join('\r\n');
        });
        const content=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Deepmind//Daily Reminders//ZH','CALSCALE:GREGORIAN',...events,'END:VCALENDAR',''].join('\r\n');
        // iCalendar lines are folded at UTF-8 byte boundaries, not JS character counts.
        const folded=content.split('\r\n').map(line=>{
            let parts=[],part='',bytes=0;
            for(const ch of line){const n=new TextEncoder().encode(ch).length;if(bytes+n>74){parts.push(part);part=' ';bytes=1;}part+=ch;bytes+=n;}parts.push(part);return parts.join('\r\n');
        }).join('\r\n');
        const url=URL.createObjectURL(new Blob([folded],{type:'text/calendar;charset=utf-8'}));
        const a=document.createElement('a');a.href=url;a.download='智能复盘-每日提醒.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
        document.getElementById('tt-calendar-status').textContent='日历文件已下载。请打开并导入系统日历，确认两项每日重复事件均启用提醒。';
    }
    function save() { try { localStorage.setItem(key,JSON.stringify(state)); } catch (_) { host.querySelector('#tt-pomo-status').textContent='浏览器存储不可用，计时无法在刷新后恢复。'; } }
    function remaining() { return state.end ? Math.max(0,state.end-Date.now()) : state.remaining; }
    function draw() {
        if(!host) return;
        const sec=Math.ceil(remaining()/1000);
        host.querySelector('#tt-clock').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
        host.querySelector('#tt-toggle').textContent=state.end?'暂停':'开始';
        host.querySelector('#tt-count').textContent=`本日完成 ${state.countDate===day()?state.count:0} 个番茄`;
        host.querySelectorAll('[data-pomo]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pomo===state.mode)));
        for (const k of ['focus','short','long']) host.querySelector(`#tt-${k}`).disabled=!!state.end;
    }
    function finish() {
        if(!state.end || Date.now()<state.end) return;
        const stored=read(key,null);
        if(stored && stored.end!==state.end){state=stored;draw();return;}
        const finished=state.mode;
        if(state.countDate!==day()){state.count=0;state.countDate=day();}
        if(finished==='focus')state.count++;
        state.mode=finished==='focus'?(state.count%4===0?'long':'short'):'focus';
        state.end=null;state.remaining=state.durations[state.mode]*60000;
        save();draw();
        host.querySelector('#tt-pomo-status').textContent=`${modeNames[finished]}结束！接下来是${modeNames[state.mode]}，准备好后点击开始。`;
        // Audio/notifications are best effort; the persistent on-page state is authoritative.
        if(state.sound && audio) { try { const o=audio.createOscillator();const gain=audio.createGain();gain.gain.value=0.12;o.connect(gain);gain.connect(audio.destination);o.start();o.stop(audio.currentTime+0.4);o.onended=()=>{o.disconnect();gain.disconnect();}; }catch(_){} }
        if(window.Notification?.permission==='granted' && document.hidden) navigator.serviceWorker?.ready.then(r=>r.showNotification('番茄时间',{body:`${modeNames[finished]}结束，可以${state.mode==='focus'?'开始下一次专注':'休息一下'}了。`,tag:'ra-pomodoro'})).catch(()=>{});
    }
    function init() {
        host=document.getElementById('time-tools');if(!host)return;
        selected=read('ra_time_block_view','personal');if(![...Object.keys(ranges),'all'].includes(selected))selected='personal';
        const fallback={mode:'focus',durations:{focus:25,short:5,long:15},remaining:1500000,end:null,count:0,countDate:day(),sound:true,task:''};
        state=read(key,fallback);
        if(!modeNames[state.mode] || !state.durations || !['focus','short','long'].every(k=>Number.isFinite(state.durations[k])&&state.durations[k]>=1&&state.durations[k]<=180) || !Number.isFinite(state.remaining) || state.remaining<0 || (state.end!==null&&!Number.isFinite(state.end)) || !Number.isInteger(state.count)||state.count<0)state=fallback;
        host.innerHTML=`<section class="tt-card" aria-label="每日提醒"><h3>⏰ 每日定时提醒</h3><p>每天 05:00 晨间规划 · 09:00 工作规划</p><button type="button" id="tt-calendar" class="tt-primary">添加到系统日历</button><p class="tt-help" id="tt-calendar-status" role="status">导入日历并开启系统通知后，关闭网站也可提醒。按设备本地时间执行；停止提醒请在日历中删除这两项重复事件。</p></section>
        <section class="tt-card" aria-label="时间板块"><h3>分开管理你的时间</h3><div class="tt-blocks"><div class="tt-block">${names.personal}<p class="tt-help">05:00–08:30 · 19:00–22:00</p><strong id="tt-rate-personal">0%</strong><span id="tt-minutes-personal"></span></div><div class="tt-block">${names.external}<p class="tt-help">09:00–18:00</p><strong id="tt-rate-external">0%</strong><span id="tt-minutes-external"></span></div></div><p class="tt-help">达成率 = 本板块工作/学习时长 ÷ 本板块总时长，两类分别计算。生活、娱乐和未安排时段不计为工作/学习；每行最多按该时间段计入。</p><div class="tt-row" role="group" aria-label="显示时间板块"><button type="button" data-block="personal">你能掌控</button><button type="button" data-block="external">别人掌控</button><button type="button" data-block="other">其他时段</button><button type="button" data-block="all">全部时段</button></div><p class="tt-help">下方时间表按所选板块显示；原有饼图仍展示全天分布。其他时段的记录保留。</p></section>
        <section class="tt-card" aria-label="番茄时间"><h3>🍅 番茄时间</h3><div class="tt-row"><button type="button" data-pomo="focus">专注</button><button type="button" data-pomo="short">短休</button><button type="button" data-pomo="long">长休</button></div><p><input id="tt-task" type="text" maxlength="120" placeholder="这次专注要做什么？" aria-label="本次专注任务"></p><div class="tt-timer" id="tt-clock" role="timer">25:00</div><div class="tt-row"><button type="button" class="tt-primary" id="tt-toggle">开始</button><button type="button" id="tt-reset">重置当前阶段</button><span id="tt-count"></span></div><details><summary>计时设置</summary><div class="tt-row"><label>专注 <input id="tt-focus" type="number" min="1" max="180"> 分钟</label><label>短休 <input id="tt-short" type="number" min="1" max="180"> 分钟</label><label>长休 <input id="tt-long" type="number" min="1" max="180"> 分钟</label><label><input id="tt-sound" type="checkbox">提示音</label></div></details><p id="tt-pomo-status" role="status" class="tt-help">每完成4次专注进入长休。刷新或重进会恢复计时；阶段结束后手动开始下一阶段。关闭网站期间无法保证到点响铃，重进时会显示结束状态。</p></section>`;
        const reminder = host.querySelector('[aria-label="每日提醒"]');
        document.getElementById('daily-reminder-tools').appendChild(reminder);
        reminder.querySelector('#tt-calendar').onclick=calendar;
        const select=()=>{filterRows();host.querySelectorAll('[data-block]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.block===selected)));};
        host.querySelectorAll('[data-block]').forEach(b=>b.onclick=()=>{selected=b.dataset.block;localStorage.setItem('ra_time_block_view',JSON.stringify(selected));select();});
        host.querySelectorAll('[data-pomo]').forEach(b=>b.onclick=()=>{
            if(b.dataset.pomo===state.mode)return;
            if((state.end||state.remaining!==state.durations[state.mode]*60000)&&!confirm('切换阶段会重置当前倒计时，继续吗？'))return;
            state.mode=b.dataset.pomo;state.end=null;state.remaining=state.durations[state.mode]*60000;save();draw();
        });
        host.querySelector('#tt-toggle').onclick=()=>{finish();if(state.end){state.remaining=remaining();state.end=null;}else{state.end=Date.now()+state.remaining;try{const C=window.AudioContext||window.webkitAudioContext;if(!audio)audio=new C();audio.resume().catch(()=>{});}catch(_){}}save();draw();};
        host.querySelector('#tt-reset').onclick=()=>{state.end=null;state.remaining=state.durations[state.mode]*60000;save();draw();};
        for(const k of ['focus','short','long']){const el=host.querySelector(`#tt-${k}`);el.value=state.durations[k];el.onchange=()=>{const n=Number(el.value);if(!Number.isInteger(n)||n<1||n>180){el.value=state.durations[k];return;}state.durations[k]=n;if(!state.end&&state.mode===k)state.remaining=n*60000;save();draw();};}
        host.querySelector('#tt-task').value=typeof state.task==='string'?state.task:'';
        host.querySelector('#tt-task').oninput=e=>{state.task=e.target.value;save();};
        host.querySelector('#tt-sound').checked=!!state.sound;host.querySelector('#tt-sound').onchange=e=>{state.sound=e.target.checked;save();};
        // Keep other open tabs in step with persisted timer changes.
        window.addEventListener('storage',e=>{if(e.key===key && e.newValue){const s=read(key,null);if(s){state=s;draw();}}});
        setInterval(()=>{finish();draw();},500);document.addEventListener('visibilitychange',()=>{finish();draw();});
        select();if(typeof updateTimeStatistics==='function')updateTimeStatistics();finish();draw();
    }
    document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));
    return { emptyBlocks, addSlot, renderBlocks, trendDatasets };
})();
