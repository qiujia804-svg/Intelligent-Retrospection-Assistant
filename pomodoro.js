(() => {
    'use strict';
    const $=id=>document.getElementById(id), key='ra_pomodoro_v1';
    const names={focus:'专注',short:'短休',long:'长休'}, colors={focus:'#f97316',short:'#34d399',long:'#60a5fa'};
    const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
    const read=()=>{try{return JSON.parse(localStorage.getItem(key));}catch(_){return null;}};
    const initial={mode:'focus',durations:{focus:25,short:5,long:15},remaining:1500000,end:null,count:0,countDate:today(),focusMinutes:0,sound:true,autoStart:true,notify:false,tasks:[],activeTask:null};
    let state=read(), audio, finishing=false;
    if(!state || !names[state.mode] || !state.durations || !Object.keys(names).every(k=>Number.isInteger(state.durations[k])&&state.durations[k]>=1&&state.durations[k]<=180) || !Number.isFinite(state.remaining)||state.remaining<0 || (state.end!==null&&!Number.isFinite(state.end)) || !Number.isInteger(state.count)||state.count<0) state=structuredClone(initial);
    // The previous timer used this same record. Keep its countdown and completed count.
    state={...initial,...state,autoStart:typeof state.autoStart==='boolean'?state.autoStart:false};
    state.tasks=Array.isArray(state.tasks)?state.tasks.filter(t=>t&&typeof t.id==='string'&&typeof t.text==='string').slice(0,200):[];
    if(state.task && !state.tasks.length)state.tasks.push({id:'legacy-task',text:String(state.task).slice(0,120),done:false});
    const notice=document.createElement('p');notice.id='notice';notice.setAttribute('role','status');document.querySelector('.card').appendChild(notice);
    const left=()=>state.end?Math.max(0,state.end-Date.now()):state.remaining;
    function persist(){try{localStorage.setItem(key,JSON.stringify(state));}catch(_){notice.textContent='浏览器存储不可用，请保持页面打开。';}}
    function resetDay(){if(state.countDate!==today()){state.countDate=today();state.count=0;state.focusMinutes=0;persist();}}
    function render(){
        resetDay();const seconds=Math.ceil(left()/1000),count=state.count%4|| (state.count?4:0);
        $('time').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
        $('time').setAttribute('role','timer');
        document.documentElement.style.setProperty('--accent',colors[state.mode]);
        const circumference=2*Math.PI*118;
        $('bar').style.strokeDasharray=String(circumference);
        $('bar').style.strokeDashoffset=String(circumference*(1-Math.min(1,left()/(state.durations[state.mode]*60000))));
        $('phase').textContent=`${state.mode==='focus'?`第 ${state.count+1} 个番茄`:`${names[state.mode]}中`} · 本组 ${count}/4`;
        $('toggle').textContent=state.end?'暂停':'开始';
        $('stat').textContent=`今日 ${state.count} 个番茄 · ${state.focusMinutes} min`;
        [...$('dots').children].forEach((d,i)=>d.classList.toggle('on',i<count));
        document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('on',b.dataset.mode===state.mode);b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode));b.textContent=`${names[b.dataset.mode]} ${state.durations[b.dataset.mode]}`;});
        for(const k of Object.keys(names)){$('d_'+k).disabled=!!state.end;if(document.activeElement!==$('d_'+k))$('d_'+k).value=state.durations[k];}
        $('autoStart').checked=state.autoStart;$('sound').checked=state.sound;$('notify').checked=state.notify;
        const pending=state.tasks.filter(t=>!t.done).length;$('tkcount').textContent=state.tasks.length?`${pending} 待完成`:'';$('tkempty').hidden=state.tasks.length>0;
        notice.textContent=state.lastNotice||notice.textContent;
    }
    function tasks(){
        $('tklist').replaceChildren();
        for(const task of state.tasks){
            const li=document.createElement('li');li.classList.toggle('done',!!task.done);li.classList.toggle('on',task.id===state.activeTask);
            const check=document.createElement('input');check.type='checkbox';check.className='task-check';check.checked=!!task.done;check.setAttribute('aria-label',`完成任务：${task.text}`);
            check.onchange=()=>{task.done=check.checked;persist();tasks();render();};
            const text=document.createElement('span');text.className='t';text.textContent=task.text;text.tabIndex=0;
            const select=()=>{state.activeTask=state.activeTask===task.id?null:task.id;persist();tasks();};text.onclick=select;text.onkeydown=e=>{if(e.key==='Enter')select();};
            text.ondblclick=()=>{task.done=!task.done;persist();tasks();render();};
            const remove=document.createElement('button');remove.type='button';remove.className='x';remove.textContent='×';remove.setAttribute('aria-label',`删除任务：${task.text}`);remove.onclick=()=>{state.tasks=state.tasks.filter(t=>t.id!==task.id);if(state.activeTask===task.id)state.activeTask=null;persist();tasks();render();};
            li.append(check,text,remove);$('tklist').appendChild(li);
        }
        resize();
    }
    function wakeAudio(){try{const C=window.AudioContext||window.webkitAudioContext;if(!audio)audio=new C();audio.resume().catch(()=>{});}catch(_){}}
    function beep(){if(!state.sound||!audio)return;try{[660,880,660,990].forEach((f,i)=>{const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.22;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.12,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.18);o.frequency.value=f;o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.2);o.onended=()=>{o.disconnect();g.disconnect();};});}catch(_){}}
    async function notify(text){
        if(!state.notify || !window.Notification || Notification.permission!=='granted')return;
        try{const registration=navigator.serviceWorker?await navigator.serviceWorker.getRegistration():null;if(registration)await registration.showNotification('番茄时间提醒',{body:text,tag:'ra-pomodoro',icon:'/icons/icon-192x192.png'});else new Notification('番茄时间提醒',{body:text,tag:'ra-pomodoro'});}catch(_){$('reminder-status').textContent='系统通知未能送达，页面提醒仍然有效。';}
    }
    function nextMode(){return state.mode==='focus'?(state.count>0&&state.count%4===0?'long':'short'):'focus';}
    async function finish(){
        if(finishing || !state.end || Date.now()<state.end)return;
        finishing=true;
        const complete=()=>{
            const stored=read();if(stored&&stored.end!==state.end){state={...state,...stored};tasks();render();return;}
            resetDay();const old=state.mode;
            if(old==='focus'){state.count++;state.focusMinutes+=state.durations.focus;}
            state.mode=nextMode();state.remaining=state.durations[state.mode]*60000;
            // Resume at most one next stage, never invent cycles elapsed while the site was closed.
            state.end=state.autoStart?Date.now()+state.remaining:null;
            state.lastNotice=`${names[old]}结束！${state.autoStart?'已开始':'接下来是'}${names[state.mode]}。`;
            persist();render();beep();void notify(state.lastNotice);
        };
        try{if(navigator.locks)await navigator.locks.request('ra-pomodoro-complete',complete);else complete();}finally{finishing=false;}
    }
    function toggle(){if(state.end&&left()===0){void finish();return;}wakeAudio();if(state.end){state.remaining=left();state.end=null;}else{state.end=Date.now()+state.remaining;}state.lastNotice='';notice.textContent='';persist();render();}
    function setMode(mode){state.mode=mode;state.end=null;state.remaining=state.durations[mode]*60000;state.lastNotice='';notice.textContent='';persist();render();}
    $('toggle').onclick=toggle;
    $('reset').onclick=()=>setMode(state.mode);
    $('skip').onclick=()=>{setMode(nextMode());if(state.autoStart){wakeAudio();state.end=Date.now()+state.remaining;persist();render();}};
    document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{if(b.dataset.mode===state.mode)return;if(state.end&&!confirm('切换阶段会重置当前倒计时，继续吗？'))return;setMode(b.dataset.mode);});
    for(const k of Object.keys(names))$('d_'+k).onchange=e=>{const n=Number(e.target.value);if(!Number.isInteger(n)||n<1||n>180){e.target.value=state.durations[k];return;}state.durations[k]=n;if(state.mode===k&&!state.end)state.remaining=n*60000;persist();render();};
    $('autoStart').onchange=e=>{state.autoStart=e.target.checked;persist();};
    $('sound').onchange=e=>{state.sound=e.target.checked;if(state.sound){wakeAudio();beep();}persist();};
    async function enableNotifications(){
        wakeAudio();
        if(!window.Notification){$('reminder-status').textContent='此浏览器不支持系统通知，到时仍会在页面提醒并播放已开启的提示音。';$('notify').checked=false;return;}
        const permission=await Notification.requestPermission().catch(()=>Notification.permission);
        state.notify=permission==='granted';persist();render();
        $('reminder-status').textContent=state.notify?'已开启系统通知：专注或休息结束时提醒。请保持网站打开，关闭后无法保证送达。':'通知权限未开启，请在浏览器的网站设置中允许通知。页面提醒仍然有效。';
        resize();
    }
    $('notify-enable').onclick=enableNotifications;
    $('notify').onchange=()=>{if($('notify').checked)void enableNotifications();else{state.notify=false;persist();}};
    function add(){const text=$('tkinput').value.trim();if(!text||state.tasks.length>=200)return;state.tasks.push({id:crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`,text:text.slice(0,120),done:false});$('tkinput').value='';persist();tasks();render();}
    $('tkadd').onclick=add;$('tkinput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();add();}};
    document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|BUTTON|SELECT/.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;const k=e.key.toLowerCase();if(k===' '){e.preventDefault();toggle();}else if(k==='r')$('reset').click();else if(k==='s')$('skip').click();else if(k==='n')$('tkinput').focus();});
    function resize(){if(parent!==window)parent.postMessage({type:'pomodoro-height',height:Math.ceil(document.querySelector('.wrap').getBoundingClientRect().height+76)},location.origin);}
    new ResizeObserver(resize).observe(document.querySelector('.wrap'));
    window.addEventListener('storage',e=>{if(e.key===key){const stored=read();if(stored){state={...state,...stored};tasks();render();}}});
    document.addEventListener('visibilitychange',()=>{void finish();render();});
    setInterval(()=>{void finish();render();},250);
    // Subtle binary background, as in the reference, without an animation loop in hidden pages.
    const cv=$('rain'),ctx=cv.getContext('2d');function paint(){cv.width=innerWidth;cv.height=innerHeight;ctx.font='12px monospace';ctx.fillStyle='rgba(96,165,250,.045)';for(let x=6;x<cv.width;x+=22)for(let y=14;y<cv.height;y+=22)ctx.fillText((x+y)%3?'0':'1',x,y);resize();}window.addEventListener('resize',paint);
    tasks();render();persist();void finish();paint();
})();
