const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME});
 try{
  const context=await browser.newContext({timezoneId:'Asia/Shanghai',serviceWorkers:'block',acceptDownloads:true});
  await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='time.test')return r.abort();if(u.pathname.startsWith('/cb/'))return r.fulfill({json:[]});const f=path.join(root,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname));return fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.fulfill({status:404});});
  await context.addInitScript(()=>{localStorage.setItem('app_version','v1.0.3');localStorage.setItem('ra_guide_acknowledged','true');window.alert=()=>{};});
  const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.clock.install({time:new Date('2026-10-23T02:00:00Z')});await p.clock.pauseAt(new Date('2026-10-23T02:00:00Z'));
  await p.goto('http://time.test/',{waitUntil:'domcontentloaded'});await p.clock.runFor(1500);
  await p.evaluate(()=>{document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));document.getElementById('plan-content').classList.add('active');});
  assert.equal(await p.locator('#schedule-items .schedule-item:visible').count(),13);
  await p.evaluate(()=>{
   for(const [time,duration] of [['05:00-05:30',30],['09:00-09:30',30],['19:00-19:30',15],['08:30-09:00',30]]){
    const row=[...document.querySelectorAll('.schedule-item')].find(r=>r.querySelector('.time-select').value===time);
    row.querySelector('.task-input').value='开发项目';row.querySelector('.duration-input').value=duration;
   }
   updateTimeStatistics();LocalStorageManager.savePlanFormNow(true);
  });
  assert.equal(await p.locator('#tt-rate-personal').innerText(),'11.5%');
  assert.equal(await p.locator('#tt-rate-external').innerText(),'5.6%');
  assert.equal(await p.evaluate(()=>getCurrentTimeStats().timeBlocks.other.workMinutes),30);
  await p.locator('[data-block="external"]').click();assert.equal(await p.locator('#schedule-items .schedule-item:visible').count(),18);
  await p.locator('[data-block="other"]').click();assert.equal(await p.locator('#schedule-items .schedule-item:visible').count(),3);
  const draft=await p.evaluate(()=>JSON.parse(localStorage.getItem('smart_review_assistant_plan_draft')));
  assert.equal(draft.schedule.filter(r=>r.task==='开发项目').length,4,'filtered-out rows still saved');
  assert.equal(await p.locator('#plan-content #tt-calendar').count(),0,'reminder no longer appears in planning');
  assert.equal(await p.locator('#challenge-content #tt-calendar').count(),1);
  await p.locator('.tab-btn[data-tab="challenge-content"]').click();
  assert.equal(await p.locator('#tt-calendar').isVisible(),true);
  // Challenge content may be rerendered for membership changes; reminders remain outside it.
  await p.evaluate(()=>renderChallengePage());
  assert.equal(await p.locator('#tt-calendar').isVisible(),true);
  const downloadPromise=p.waitForEvent('download');await p.locator('#tt-calendar').click();const download=await downloadPromise;
  const chunks=[];const stream=await download.createReadStream();for await(const chunk of stream)chunks.push(chunk);const ics=Buffer.concat(chunks).toString('utf8').replace(/\r\n /g,'');
  assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,2);assert.equal((ics.match(/RRULE:FREQ=DAILY/g)||[]).length,2);
  assert.match(ics,/DTSTART:20261024T050000/);assert.match(ics,/DTSTART:20261024T090000/);assert.equal((ics.match(/BEGIN:VALARM/g)||[]).length,2);
  assert.match(await p.locator('#tt-calendar-status').innerText(),/日历文件已下载/);
  await p.locator('.tab-btn[data-tab="plan-content"]').click();
  await p.locator('details').filter({has:p.locator('#tt-focus')}).locator('summary').click();
  await p.locator('#tt-focus').fill('1');await p.locator('#tt-focus').dispatchEvent('change');
  await p.locator('#tt-sound').uncheck();await p.locator('#tt-task').fill('专注测试');
  await p.locator('#tt-toggle').click();await p.clock.runFor(20000);
  assert.equal(await p.locator('#tt-clock').innerText(),'00:40');
  await p.reload({waitUntil:'domcontentloaded'});await p.clock.runFor(1000);
  assert.equal(await p.locator('#tt-task').inputValue(),'专注测试');assert.equal(await p.locator('#tt-clock').innerText(),'00:39');
  await p.evaluate(()=>{document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));document.getElementById('plan-content').classList.add('active');});
  assert.equal(await p.locator('#tt-rate-external').innerText(),'5.6%');assert.equal(await p.locator('#schedule-items .schedule-item:visible').count(),3);
  await p.locator('#tt-toggle').click();await p.clock.runFor(5000);assert.equal(await p.locator('#tt-clock').innerText(),'00:39','paused clock stays fixed');
  await p.locator('#tt-toggle').click();await p.clock.runFor(40000);
  assert.equal(await p.locator('#tt-clock').innerText(),'05:00');assert.match(await p.locator('#tt-count').innerText(),/1 个番茄/);
  assert.match(await p.locator('#tt-pomo-status').innerText(),/专注结束/);
  const trend=await p.evaluate(()=>TimeTools.trendDatasets());assert.equal(trend.length,2);assert.equal(trend[0].data[6],11.5);assert.equal(trend[1].data[6],5.6);assert.equal(trend[0].data[0],null);
  const rendered=await p.evaluate(()=>{initCompletionTrendChart([]);return completionTrendChart.data.datasets.map(d=>({label:d.label,last:d.data[6]}));});
  assert.equal(rendered.length,2);assert.equal(rendered[1].last,5.6,'overview renders separate curves');
  const capped=await p.evaluate(()=>{const b=TimeTools.emptyBlocks();TimeTools.addSlot(b,'08:00-08:30',180,true);TimeTools.addSlot(b,'08:30-09:00',30,true);return b;});
  assert.equal(capped.personal.workMinutes,30);assert.equal(capped.other.workMinutes,30);assert.equal(capped.external.workMinutes,0);
  const legacy=await p.evaluate(()=>TimeTools.trendDatasets([{date:'2026-10-22',goalCompletion:{percentage:35}}]));
  assert.equal(legacy.length,3);assert.equal(legacy[2].data[5],35,'historical aggregate remains visible without inventing split rates');
  // Four focus completions select a long break without manufacturing offline sessions.
  await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('ra_pomodoro_v1'));s.count=3;s.mode='focus';s.end=Date.now()-100;s.remaining=0;localStorage.setItem('ra_pomodoro_v1',JSON.stringify(s));});
  await p.reload({waitUntil:'domcontentloaded'});await p.clock.runFor(1000);
  assert.equal(await p.locator('#tt-clock').innerText(),'15:00');assert.match(await p.locator('#tt-count').innerText(),/4 个番茄/);
  await p.setViewportSize({width:390,height:844});
  await p.evaluate(()=>{document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));document.getElementById('plan-content').classList.add('active');});
  const overflows=await p.locator('#time-tools').evaluate(e=>e.scrollWidth>e.clientWidth+1);assert.equal(overflows,false,'mobile tools fit viewport');
  assert.deepEqual(errors,[]);
  console.log('PASS: separate rates, all hidden records preserved, daily calendar alarms, timer pause/reload/expiry/fourth long break, mobile layout');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
