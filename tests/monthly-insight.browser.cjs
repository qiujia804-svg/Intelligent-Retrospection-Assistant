const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME});
 try{
  const c=await b.newContext({timezoneId:'Asia/Shanghai'});
  await c.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='monthly.test')return r.abort();if(u.pathname.startsWith('/cb/'))return r.fulfill({json:[]});const f=path.join(root,u.pathname==='/'?'index.html':u.pathname);return fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.fulfill({status:404});});
  await c.addInitScript(()=>{
   localStorage.setItem('app_version','v1.0.3');localStorage.setItem('ra_guide_acknowledged','true');
   if(localStorage.getItem('monthly_seed'))return;localStorage.setItem('monthly_seed','1');
   const d=new Date(),date=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
   const stats={items:[{name:'软件开发',minutes:60}],totalMinutes:60,studyTotalMinutes:60};
   localStorage.setItem('smart_review_assistant_reviews',JSON.stringify([{date,goalCompletion:{percentage:100,description:''},timeStats:stats}]));
   localStorage.setItem('smart_review_assistant_plans',JSON.stringify([{date,quadrants:{a:[{what:'任务一'},{what:'任务二'},{what:'任务三'}],b:[],c:[],d:[]},schedule:[]}]));
  });
  let p=await c.newPage();p.setDefaultTimeout(8000);
  const verify=async()=>{
   await p.goto('http://monthly.test/',{waitUntil:'domcontentloaded'});
   await p.waitForFunction(()=>document.getElementById('total-investment').textContent==='1小时');
   assert.equal(await p.locator('.challenge-notification').count(),0,'automatic task restoration must be silent');
   await p.evaluate(()=>{document.getElementById('splash-screen')?.remove();document.getElementById('ra-modal-overlay')?.remove();});
   await p.locator('.tab-btn[data-tab="history-content"]').click();
   await p.waitForFunction(()=>barChartInstance?.getOption().series?.[0]?.data?.length);
   assert.deepEqual(await p.evaluate(()=>barChartInstance.getOption().series[0].data.map(x=>typeof x==='object'?x.value:x)),[60]);
   assert.equal(await p.locator('#radar-chart canvas').count()>0,true);
  };
  await verify();await p.reload({waitUntil:'domcontentloaded'});await verify();
  await p.close();p=await c.newPage();await verify();
  await p.evaluate(()=>showNotification('任务项添加成功','success'));
  assert.equal(await p.locator('.notification-body').filter({hasText:'success'}).count(),0);
  await p.evaluate(()=>{localStorage.removeItem('smart_review_assistant_reviews');updateDataInsight();});
  assert.equal(await p.locator('#total-investment').innerText(),'0 小时');
  assert.equal(await p.evaluate(()=>barChartInstance.getOption().series?.length||0),0,'no fake monthly data');
  console.log('PASS: silent restore, real saved monthly charts on load/reload/reopen, no raw success and no fabricated empty-state data');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
