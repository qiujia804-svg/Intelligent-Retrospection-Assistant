const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME});
 try{
  const c=await b.newContext({timezoneId:'Asia/Shanghai',serviceWorkers:'block'});
  await c.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='pomo.test')return r.abort();if(u.pathname.startsWith('/cb/'))return r.fulfill({json:[]});const f=path.join(root,u.pathname==='/'?'index.html':u.pathname);return fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.fulfill({status:404});});
  await c.addInitScript(()=>{
   localStorage.setItem('app_version','v1.0.3');localStorage.setItem('ra_guide_acknowledged','true');
   window.testNotifications=[];window.testAudio=0;
   window.Notification=class{static permission='default';static async requestPermission(){this.permission='granted';return 'granted';}constructor(title,options){window.testNotifications.push({title,...options});}};
   window.AudioContext=class{currentTime=0;destination={};resume(){return Promise.resolve();}createOscillator(){window.testAudio++;return{frequency:{},connect(){},disconnect(){},start(){},stop(){}};}createGain(){return{gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}};
   if(!localStorage.getItem('pomo-seeded')){localStorage.setItem('pomo-seeded','1');localStorage.setItem('ra_pomodoro_v1',JSON.stringify({mode:'focus',durations:{focus:25,short:5,long:15},remaining:1500000,end:null,count:2,countDate:'2026-10-23',sound:true,task:'旧版任务'}));}
  });
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.clock.install({time:new Date('2026-10-23T02:00:00Z')});await p.clock.pauseAt(new Date('2026-10-23T02:00:00Z'));
  await p.goto('http://pomo.test/',{waitUntil:'domcontentloaded'});await p.clock.runFor(1500);
  await p.evaluate(()=>{document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));document.getElementById('plan-content').classList.add('active');});
  await p.locator('[data-time-view="pomodoro"]').click();
  const f=p.frameLocator('#pomodoro-frame');await f.locator('#time').waitFor();
  assert.equal(await f.locator('#time').innerText(),'25:00');assert.match(await f.locator('#stat').innerText(),/今日 2 个番茄/);assert.match(await f.locator('#tklist').innerText(),/旧版任务/);
  assert.equal(await f.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(10, 14, 20)');
  await f.locator('#tkinput').fill('<img src=x onerror=alert(1)>');await f.locator('#tkadd').click();assert.equal(await f.locator('#tklist img').count(),0,'task text cannot inject markup');
  await f.locator('#tklist .task-check').last().check();assert.equal(await f.locator('#tklist li.done').count(),1);
  await f.locator('#d_focus').fill('1');await f.locator('#d_focus').dispatchEvent('change');await f.locator('#autoStart').uncheck();
  await f.locator('#notify-enable').click();assert.equal(await f.locator('#notify').isChecked(),true);
  await f.locator('#toggle').click();await p.clock.runFor(20000);assert.equal(await f.locator('#time').innerText(),'00:40');
  assert.equal(await f.locator('#d_focus').isDisabled(),true);
  await p.reload({waitUntil:'domcontentloaded'});await p.clock.runFor(1000);await p.evaluate(()=>{document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));document.getElementById('plan-content').classList.add('active');});
  assert.equal(await f.locator('#time').innerText(),'00:39');assert.equal(await f.locator('#tklist li').count(),2);
  await f.locator('#toggle').click();await p.clock.runFor(5000);assert.equal(await f.locator('#time').innerText(),'00:39');
  await f.locator('#toggle').click();await p.clock.runFor(40000);
  assert.equal(await f.locator('#time').innerText(),'05:00');assert.match(await f.locator('#stat').innerText(),/今日 3 个番茄 · 1 min/);assert.match(await f.locator('#notice').innerText(),/专注结束/);
  assert((await p.frames().find(fr=>fr.url().endsWith('/pomodoro.html')).evaluate(()=>window.testAudio))>0,'completion tone generated');
  // Permission mocked as granted again after reload, as real browsers retain it.
  await f.locator('#notify-enable').click();await f.locator('[data-mode="focus"]').click();await f.locator('#toggle').click();await p.clock.runFor(61000);
  assert.equal(await f.locator('#time').innerText(),'15:00');assert.match(await f.locator('#stat').innerText(),/今日 4 个番茄 · 2 min/);
  assert.equal(await p.frames().find(fr=>fr.url().endsWith('/pomodoro.html')).evaluate(()=>window.testNotifications.length),1);
  await f.locator('#autoStart').check();await f.locator('#skip').click();assert.equal(await f.locator('#toggle').innerText(),'暂停');assert.match(await f.locator('#stat').innerText(),/4 个番茄/,'skip does not create completed sessions');
  await f.locator('#reset').click();assert.equal(await f.locator('#time').innerText(),'01:00');
  await p.setViewportSize({width:480,height:900});await p.clock.runFor(500);
  assert.equal(await f.locator('body').evaluate(e=>e.scrollWidth>innerWidth),false,'mobile layout has no horizontal overflow');
  if(process.env.TEST_SCREENSHOT)await p.locator('#pomodoro-frame').screenshot({path:process.env.TEST_SCREENSHOT});
  assert.deepEqual(errors,[]);
  console.log('PASS: reference styling, migrated data, safe tasks, pause/reload, stage progression, four-focus long break, sound, notification, skip, mobile');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
