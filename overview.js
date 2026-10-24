window.OverviewPanel = (() => {
    'use strict';
    const $=id=>document.getElementById(id);
    const date=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const load=key=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[];}catch(_){return[];}};
    const valid=b=>b && Number.isFinite(b.rate) && Number.isFinite(b.totalMinutes) && b.totalMinutes>0 && (b.recordedMinutes>0||b.taskCount>0);
    const rate=b=>`${Math.min(100,Math.max(0,b.rate)).toFixed(1).replace(/\.0$/,'')}%`;
    function records(){
        const map=new Map();
        for(const key of ['smart_review_assistant_reviews','smart_review_assistant_plans'])for(const r of load(key))if(r?.date&&r.timeStats?.timeBlocks)map.set(String(r.date).split('T')[0],r.timeStats.timeBlocks);
        return map;
    }
    function render(){
        if(!$('overview-panel'))return;
        const map=records(),now=new Date(),today=date(now),blocks=map.get(today);
        for(const k of ['personal','external']){
            const block=blocks?.[k],has=valid(block),value=$(`overview-${k}-rate`);
            value.textContent=has?rate(block):'暂无记录';value.classList.toggle('empty',!has);
            $(`overview-${k}-minutes`).textContent=has?`工作/学习 ${Math.max(0,block.workMinutes||0)} 分钟 · 投入达成率`:'记录后查看今日投入';
            $(`overview-${k}-bar`).style.width=has?rate(block):'0%';
        }
        [7,14,21,28].forEach((end,index)=>{
            const entries=[];
            for(let n=index*7;n<end;n++){const d=new Date(now);d.setDate(d.getDate()-n);entries.push(map.get(date(d)));}
            const target=$(`segment-${end}`);target.replaceChildren();
            for(const k of ['personal','external']){
                const values=entries.map(b=>b?.[k]).filter(valid),line=document.createElement('div');line.className=`overview-week-line ${k}`;
                const label=document.createElement('span');label.textContent=k==='personal'?'自主时间':'工作时间';const value=document.createElement('b');
                const total=values.reduce((s,b)=>s+b.totalMinutes,0);
                value.textContent=total?rate({rate:values.reduce((s,b)=>s+b.rate*b.totalMinutes,0)/total}):'暂无记录';
                line.append(label,value);target.appendChild(line);
            }
        });
        // Last saved review and count are independent of whether its completion is positive.
        const dates=[...new Set(load('smart_review_assistant_reviews').map(r=>String(r.date||'').split('T')[0]).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&d<=today))].sort();
        $('total-days').textContent=dates.length;
        $('last-review').textContent=dates.length?`${Number(dates.at(-1).slice(5,7))}月${Number(dates.at(-1).slice(8,10))}日`:'暂无记录';
    }
    let timer;
    function schedule(){clearTimeout(timer);timer=setTimeout(()=>{render();if(typeof initCompletionTrendChart==='function')initCompletionTrendChart(typeof getReviews==='function'?getReviews():[]);},200);}
    window.addEventListener('storage',schedule);
    window.addEventListener('plan-day-changed',schedule);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
    document.addEventListener('DOMContentLoaded',()=>setTimeout(render,0));
    return { render, schedule };
})();
