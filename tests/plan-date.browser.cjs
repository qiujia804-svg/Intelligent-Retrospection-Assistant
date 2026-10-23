const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME});
 try{
  const c=await b.newContext({timezoneId:'Asia/Shanghai'}),p=await c.newPage();p.setDefaultTimeout(8000);
  await p.clock.setFixedTime(new Date('2026-10-23T01:00:00Z'));
  await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='plan-date.test')return r.abort();if(u.pathname.startsWith('/cb/'))return r.fulfill({json:[]});const f=path.join(root,u.pathname==='/'?'index.html':u.pathname);return fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.fulfill({status:404});});
  await p.addInitScript(()=>{
   localStorage.setItem('ra_guide_acknowledged','true');
   localStorage.setItem('app_version','v1.0.3');
   if(localStorage.getItem('date_test_seeded'))return;
   localStorage.setItem('date_test_seeded','1');
   const make=(what,date)=>({date,quadrants:{a:[{what}],b:[],c:[],d:[]},schedule:[{time:'09:00-09:30',task:what,duration:'30'}]});
   const yesterday=make('昨天的安排','2026-10-22');delete yesterday.date;
   yesterday.timestamp=new Date('2026-10-22T10:00:00Z').getTime();
   localStorage.setItem('smart_review_assistant_plan_draft',JSON.stringify(yesterday));
   localStorage.setItem('smart_review_assistant_plans',JSON.stringify([make('今天已保存的安排','2026-10-23')]));
  });
  await p.goto('http://plan-date.test/',{waitUntil:'domcontentloaded'});await p.waitForTimeout(1400);
  assert.equal(await p.locator('#quadrant-a .task-what').first().inputValue(),'今天已保存的安排','yesterday draft must never override today');
  await p.evaluate(()=>{document.getElementById('splash-screen')?.remove();document.getElementById('ra-modal-overlay')?.remove();document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));document.getElementById('plan-content').classList.add('active');});
  const field=p.locator('#quadrant-a .task-what').first();await field.fill('今天刚改的工作');
  await p.evaluate(()=>LocalStorageManager.restoreDraftData());
  assert.equal(await field.inputValue(),'今天刚改的工作','tab/visibility restoration must not overwrite current edits');
  await p.reload({waitUntil:'domcontentloaded'});await p.waitForTimeout(1400);
  assert.equal(await field.inputValue(),'今天刚改的工作','immediate reload preserves manual edits');
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('smart_review_assistant_plan_draft:2026-10-22')).quadrants.a[0].what),'昨天的安排','old draft is archived rather than discarded');
  await p.clock.setFixedTime(new Date('2026-10-23T16:01:00Z'));
  await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  assert.equal(await field.inputValue(),'','after local midnight do not reuse yesterday tasks');
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('smart_review_assistant_plans')).find(x=>x.date==='2026-10-23').quadrants.a[0].what),'今天刚改的工作','rollover retains prior day');
  await p.evaluate(()=>{document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));document.getElementById('plan-content').classList.add('active');});
  await field.fill('新一天的工作');
  const timeRow=p.locator('#schedule-items .schedule-item').filter({has:p.locator('option[value="09:00-09:30"]')});
  await timeRow.locator('.task-input').fill('新一天的时间安排');
  await timeRow.locator('.duration-input').fill('20');
  await p.reload({waitUntil:'domcontentloaded'});await p.waitForTimeout(1000);
  assert.equal(await field.inputValue(),'新一天的工作');
  assert.equal(await timeRow.locator('.task-input').inputValue(),'新一天的时间安排');
  assert.equal(await timeRow.locator('.duration-input').inputValue(),'20');
  console.log('PASS: local day boundaries, prior draft preservation, today restore, manual edits and immediate refresh');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
