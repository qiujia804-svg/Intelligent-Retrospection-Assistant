const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME});
 try{
  const context=await browser.newContext({timezoneId:'Asia/Shanghai',serviceWorkers:'block'});
  await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='quadrants.test')return r.abort();if(u.pathname.startsWith('/cb/'))return r.fulfill({json:[]});const f=path.join(root,u.pathname==='/'?'index.html':u.pathname);return fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.fulfill({status:404});});
  await context.addInitScript(()=>{
   localStorage.setItem('app_version','v1.0.3');localStorage.setItem('ra_guide_acknowledged','true');
   if(localStorage.getItem('quad-seed'))return;localStorage.setItem('quad-seed','1');
   const d=new Date(),date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
   localStorage.setItem('smart_review_assistant_plans',JSON.stringify([{date,quadrants:Object.fromEntries(['a','b','c','d'].map(k=>[k,Array.from({length:6},(_,i)=>({what:`${k}任务${i+1}`}))])),schedule:[]}]));
  });
  const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://quadrants.test/',{waitUntil:'domcontentloaded'});await p.waitForTimeout(1000);
  const open=()=>p.evaluate(()=>{document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));document.getElementById('plan-content').classList.add('active');});await open();
  for(const width of [1280,390]){
   await p.setViewportSize({width,height:900});await p.waitForTimeout(500);
   for(const k of ['a','b','c','d']){
    const list=p.locator('#quadrant-'+k);assert.equal(await list.locator('.task-item').count(),6);
    const geometry=await list.evaluate(e=>{e.scrollTop=0;const a=e.children[0],b=e.children[1],c=e.children[2];return{height:e.clientHeight,two:b.offsetTop-a.offsetTop+b.offsetHeight,three:c.offsetTop-a.offsetTop+c.offsetHeight,scroll:e.scrollHeight};});
    assert(geometry.height>=geometry.two&&geometry.height<=geometry.two+8,'exactly two card heights fit');assert(geometry.scroll>geometry.height&&geometry.three>geometry.height,'extra cards stay in scroll area');
    await list.locator('.task-what').last().fill(`${k}第六项更新`);assert((await list.evaluate(e=>e.scrollTop))>0,'lower fields scroll into view and stay editable');
   }
  }
  await p.reload({waitUntil:'domcontentloaded'});await p.waitForTimeout(1000);await open();
  for(const k of ['a','b','c','d'])assert.equal(await p.locator(`#quadrant-${k} .task-what`).last().inputValue(),`${k}第六项更新`);
  await p.locator('#quadrant-a .add-task-btn').last().click();assert.equal(await p.locator('#quadrant-a .task-item').count(),7);
  await p.locator('#quadrant-a .remove-task-btn').last().click();assert.equal(await p.locator('#quadrant-a .task-item').count(),6);
  assert.deepEqual(errors,[]);console.log('PASS: four independent two-card viewports on desktop/mobile, lower tasks editable, refresh persists all tasks, add/remove retained');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
