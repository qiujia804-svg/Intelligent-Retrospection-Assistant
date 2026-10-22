const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME});
 try {
  for (const missingChart of [false,true]) {
  const p=await b.newPage();
  p.setDefaultTimeout(8000);
  const errors=[];p.on('console',msg=>{if(msg.type()==='error' && msg.text().includes('应用初始化失败'))errors.push(msg.text());});
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='guest.test'||(missingChart&&u.pathname==='/vendor/chart.umd.js'))return r.abort();const f=path.join(root,u.pathname==='/'?'index.html':u.pathname);return fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.fulfill({status:404});});
  await p.goto('http://guest.test/',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1500);
  console.log('Startup errors:',errors);
  assert.equal(errors.length,0,'guest startup must survive external CDN failures');
  await p.evaluate(()=>document.getElementById('ra-modal-overlay')?.remove());
  await p.locator('#member-center-btn').click();
  await p.locator('#vip-center-overlay').waitFor({state:'visible'});
  assert.equal(await p.evaluate(()=>localStorage.getItem('currentUser')),null);
  assert.equal(await p.evaluate(()=>typeof Chart),missingChart?'undefined':'function');
  await p.reload({waitUntil:'domcontentloaded'});await p.waitForTimeout(1200);
  assert.equal(errors.length,0,'refresh must remain functional');
  await p.close();
  }
  console.log('PASS: fresh guest, blocked external services, member center, local charts, refresh');
 } finally {await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
