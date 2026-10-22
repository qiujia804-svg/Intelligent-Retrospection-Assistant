const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME});
 try{
  const p=await b.newPage();p.setDefaultTimeout(8000);let fail=false;const auth=[];
  await p.route('**/*',r=>{
   const u=new URL(r.request().url());if(u.hostname!=='admin.test')return r.abort();
   if(u.pathname.endsWith('/v1/verification'))return r.fulfill({json:{verification_id:'test-id',is_user:true}});
   if(u.pathname.endsWith('/v1/verification/verify'))return r.fulfill({json:{verification_token:'test-proof'}});
   if(u.pathname.endsWith('/v1/signin'))return r.fulfill({json:{access_token:'test-admin-token',refresh_token:'test-refresh',expires_in:3600,sub:'2107394523863711744'}});
   if(u.pathname.endsWith('/v1/user/me'))return r.fulfill({json:{sub:'2107394523863711744',email:'admin@example.invalid'}});
   if(u.pathname.includes('/rpc/')){
    auth.push(r.request().headers().authorization);
    if(fail)return r.fulfill({status:404,json:{code:'PGRST202',message:'test function unavailable'}});
    const name=u.pathname.split('/').pop();let data=[];
    if(name==='admin_usage_summary')data={users:1,logins:1,avg_sec:45,total_sec:45};
    if(name==='admin_usage_users')data=[{email:'new-user@example.invalid',logins:1,sessions:1,total_sec:45,avg_sec:45}];
    if(name==='admin_stats')data={members_total:1,trial_active:1,revenue:0,ai_calls_total:0};
    return r.fulfill({json:data});
   }
   const f=path.join(root,u.pathname==='/'?'admin-members.html':u.pathname);
   return fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.fulfill({status:404});
  });
  await p.goto('http://admin.test/',{waitUntil:'domcontentloaded'});
  await p.locator('#emailInput').fill('admin@example.invalid');await p.locator('#loginBtn').click();
  await p.locator('#codeInput').fill('123456');await p.locator('#loginBtn').click();
  await p.waitForFunction(()=>document.getElementById('usageBody').textContent.includes('new-user@example.invalid')).catch(async e=>{console.log(await p.evaluate(()=>({login:document.getElementById('loginMsg').textContent,usage:document.getElementById('usageMsg').textContent,admin:document.getElementById('adminMsg').textContent})));throw e;});
  assert(auth.length>=4);assert(auth.every(h=>h==='Bearer test-admin-token'));
  fail=true;await p.locator('#usageRefreshBtn').click();
  await p.waitForFunction(()=>document.getElementById('usageMsg').textContent.includes('test function unavailable'));
  assert.match(await p.locator('#usageMsg').innerText(),/test function unavailable/);
  console.log('PASS: local pinned SDK, authenticated admin queries, email list, actionable query errors');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
