const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME});
 try{
  const c=await b.newContext({timezoneId:'Asia/Shanghai',serviceWorkers:'block'});
  await c.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='overview.test')return r.abort();if(u.pathname.startsWith('/cb/'))return r.fulfill({json:[]});const f=path.join(root,u.pathname==='/'?'index.html':u.pathname);return fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.fulfill({status:404});});
  await c.addInitScript(()=>{localStorage.setItem('app_version','v1.0.3');localStorage.setItem('ra_guide_acknowledged','true');});
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  p.setDefaultTimeout(10000);
  await p.clock.install({time:new Date('2026-10-24T12:00:00Z')});await p.clock.pauseAt(new Date('2026-10-24T12:00:00Z'));
  await p.goto('http://overview.test/',{waitUntil:'domcontentloaded'});await p.clock.runFor(1500);
  assert.equal(await p.locator('#overview-personal-rate').innerText(),'暂无记录');assert.match(await p.locator('#segment-7').innerText(),/暂无记录/);
  await p.evaluate(()=>{
   const block=(work,total,recorded=30)=>({totalMinutes:total,workMinutes:work,recordedMinutes:recorded,taskCount:recorded?1:0,rate:Math.round(work/total*1000)/10});
   localStorage.setItem('smart_review_assistant_reviews',JSON.stringify([
    {date:'2026-10-24',strengths:'今天的复盘',goalCompletion:{percentage:0},timeStats:{timeBlocks:{personal:block(45,360),external:block(0,540)}}},
    {date:'2026-10-23',goalCompletion:{percentage:0},timeStats:{timeBlocks:{personal:block(90,360),external:block(0,540,0)}}},
    {date:'2026-10-16',goalCompletion:{percentage:50},timeStats:{timeBlocks:{personal:block(90,180),external:block(0,540,0)}}}
   ]));
   for(const [time,task,mins] of [['05:00-05:30','工作——项目',30],['19:00-19:30','工作——项目',15],['09:00-09:30','通勤',30]]){
    const row=[...document.querySelectorAll('.schedule-item')].find(r=>r.querySelector('.time-select').value===time);row.querySelector('.task-input').value=task;row.querySelector('.duration-input').value=mins;
   }
   updateTimeStatistics();LocalStorageManager.savePlanFormNow(true);updateDataOverview();
  });await p.clock.runFor(500);
  assert.equal(await p.locator('#overview-personal-rate').innerText(),'12.5%');assert.equal(await p.locator('#overview-external-rate').innerText(),'0%','recorded life time is a real zero-work result');
  assert.match(await p.locator('#overview-personal-minutes').innerText(),/45 分钟/);
  assert.match(await p.locator('#segment-7 .personal').innerText(),/18.8%/);assert.match(await p.locator('#segment-7 .external').innerText(),/0%/);
  assert.match(await p.locator('#segment-14 .personal').innerText(),/50%/);assert.match(await p.locator('#segment-21').innerText(),/暂无记录/);
  assert.equal(await p.locator('#last-review').innerText(),'10月24日','zero-rate review still counts as last review');
  assert.equal(await p.locator('#total-days').innerText(),'3');assert.equal(await p.locator('#avg-completion').count(),0);
  const datasets=await p.evaluate(()=>completionTrendChart.data.datasets.map(d=>({label:d.label,color:d.borderColor})));assert.equal(datasets[0].label,'自主时间');assert.equal(datasets[1].label,'工作时间');assert.notEqual(datasets[0].color,datasets[1].color);
  await p.setViewportSize({width:1280,height:1100});await p.clock.runFor(500);
  console.log('Overview statistics passed; checking layout');
  if(process.env.TEST_SCREENSHOT){await p.clock.resume();await p.locator('#overview-panel').screenshot({path:process.env.TEST_SCREENSHOT,animations:'disabled'});}
  await p.locator('#segment-toggle').uncheck();assert.equal(await p.locator('.segment-cards').isVisible(),false);await p.locator('#segment-toggle').check();
  await p.reload({waitUntil:'domcontentloaded'});await p.clock.runFor(1500);assert.equal(await p.locator('#overview-personal-rate').innerText(),'12.5%');
  await p.setViewportSize({width:390,height:844});await p.clock.runFor(500);
  await p.reload({waitUntil:'domcontentloaded'});await p.clock.runFor(1500);
  await p.locator('#review-content .mtb-item').last().click();await p.clock.runFor(500);
  assert.equal(await p.locator('#overview-panel').isVisible(),true);assert.equal(await p.locator('#overview-panel').evaluate(e=>e.scrollWidth>e.clientWidth+1),false,'mobile overview fits');
  assert.deepEqual(errors,[]);console.log('PASS: light dual cards, separate colored curves, real zero vs missing, four-week weighting, last saved review, refresh, mobile');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
