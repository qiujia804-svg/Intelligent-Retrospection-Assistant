const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME});
 try{for(const missingSdk of [false,true]){
  const p=await b.newPage();p.setDefaultTimeout(8000);const sent=[];
  await p.addInitScript(()=>{localStorage.setItem('ra_guide_acknowledged','true');window.alert=m=>(window.testAlerts??=[]).push(m);});
  await p.route('**/*',r=>{
   const u=new URL(r.request().url());
   if(u.hostname!=='registration.test'||(missingSdk&&u.pathname==='/vendor/workbuddy-cloud-sdk.js'))return r.abort();
   if(r.request().method()==='POST')sent.push(u.pathname);
   if(u.pathname.endsWith('/v1/verification'))return r.fulfill({json:{verification_id:'test-id',is_user:false}});
   if(u.pathname.startsWith('/cb/'))return r.fulfill({json:[]});
   const f=path.join(root,u.pathname==='/'?'index.html':u.pathname);
   return fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.fulfill({status:404});
  });
  await p.goto('http://registration.test/',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1000);
  await p.evaluate(()=>{document.getElementById('splash-screen')?.remove();document.getElementById('ra-modal-overlay')?.remove();});
  await p.locator('#register-btn').click();
  await p.locator('#register-email').fill('registration-test@example.invalid');
  await p.locator('#send-verify-code').click();
  await p.waitForFunction(()=>window.testAlerts?.length);
  assert(!sent.includes('/api/send-email'),'must never call deleted legacy email endpoint');
  if(missingSdk){
   assert.equal(sent.length,0);
   assert.match((await p.evaluate(()=>window.testAlerts))[0],/云服务暂时不可用/);
   assert.equal(await p.locator('#send-verify-code').isEnabled(),true);
  }else{
   assert(sent.some(s=>s.endsWith('/v1/verification')));
   assert.equal(await p.locator('#verify-code-group').isVisible(),true);
   assert.match((await p.evaluate(()=>window.testAlerts))[0],/验证码已发送/);
  }
  await p.close();
 }
 console.log('PASS: blocked external CDNs still use cloud registration; missing SDK never falls back to legacy email');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
