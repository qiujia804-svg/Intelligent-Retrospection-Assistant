const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME});
 try{
  const p=await b.newPage({timezoneId:'Asia/Shanghai'});
  await p.clock.install({time:new Date('2026-10-23T15:59:50Z')});
  await p.clock.pauseAt(new Date('2026-10-23T15:59:50Z'));
  await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='midnight.test')return r.abort();if(u.pathname.startsWith('/cb/'))return r.fulfill({json:[]});const f=path.join(root,u.pathname==='/'?'index.html':u.pathname);return fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.fulfill({status:404});});
  await p.addInitScript(()=>{
   localStorage.setItem('app_version','v1.0.3');localStorage.setItem('ra_guide_acknowledged','true');
   if(localStorage.getItem('midnight_seeded'))return;localStorage.setItem('midnight_seeded','1');
   localStorage.setItem('smart_review_assistant_plans',JSON.stringify([{date:'2026-10-23',quadrants:{a:[{what:'今晚的工作'}],b:[],c:[],d:[]},schedule:[{time:'09:00-09:30',task:'今晚的工作',duration:'30'}]}]));
  });
  await p.goto('http://midnight.test/',{waitUntil:'domcontentloaded'});await p.clock.runFor(1000);
  assert.equal(await p.locator('#quadrant-a .task-what').first().inputValue(),'今晚的工作');
  await p.evaluate(()=>{document.getElementById('ai-plan-input').value='昨晚尚未生成的计划';document.getElementById('ai-plan-dialog').showModal();});
  await p.clock.runFor(10000);
  assert.equal(await p.locator('#quadrant-a .task-what').first().inputValue(),'','open page clears without interaction at local midnight');
  assert.equal(await p.locator('#schedule-items .task-input').evaluateAll(es=>es.every(e=>e.value==='')),true);
  assert.equal(await p.evaluate(()=>timeDistributionChart.data.datasets[0].data.length),0);
  assert.equal(await p.locator('#ai-plan-input').inputValue(),'');
  assert.equal(await p.evaluate(()=>document.getElementById('ai-plan-dialog').open),false);
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('smart_review_assistant_plans')).find(x=>x.date==='2026-10-23').quadrants.a[0].what),'今晚的工作');
  await p.evaluate(()=>{document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));document.getElementById('plan-content').classList.add('active');});
  await p.locator('#quadrant-a .task-what').first().fill('新一天最新工作');
  await p.reload({waitUntil:'domcontentloaded'});await p.clock.runFor(1000);
  assert.equal(await p.locator('#quadrant-a .task-what').first().inputValue(),'新一天最新工作');
  console.log('PASS: unattended midnight reset, empty schedule/chart, closed old AI proposal, previous day retained, next-day edits restored');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
