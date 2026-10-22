const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME});
 try {
  const p=await browser.newPage();p.setDefaultTimeout(8000);
  const visits=[];
  await p.addInitScript(()=>{localStorage.setItem('ra_guide_acknowledged','true');window.alert=m=>(window.testAlerts??=[]).push(m);});
  await p.route('**/*',r=>{
   const u=new URL(r.request().url());
   // TEST_CLOUD_SDK may point to a local copy of the exact SDK pinned in index.html.
   if(u.hostname!=='auth.test'&&u.href.includes('workbuddy-cloud-sdk'))return process.env.TEST_CLOUD_SDK
       ? r.fulfill({path:process.env.TEST_CLOUD_SDK,contentType:'text/javascript'}) : r.continue();
   if(u.hostname!=='auth.test')return r.abort();
   if(['/v1/token','/v1/signin','/v1/signup'].some(s=>u.pathname.endsWith(s)))return r.fulfill({json:{access_token:'test-access-token',refresh_token:'test-refresh-token',expires_in:3600,sub:'test-user'}});
   if(u.pathname.endsWith('/v1/verification'))return r.fulfill({json:{verification_id:'test-verification-id',is_user:false}});
   if(u.pathname.endsWith('/v1/verification/verify'))return r.fulfill({json:{verification_token:'test-verification-token'}});
   if(u.pathname.endsWith('/v1/user/me'))return r.fulfill({json:{sub:'test-user',email:'auth-test@example.invalid'}});
   if(u.pathname.endsWith('/rpc/record_visit')) {
    visits.push({body:r.request().postDataJSON(),authorization:r.request().headers().authorization});
    return r.fulfill({json:{ok:true}});
   }
   if(u.pathname.startsWith('/cb/'))return r.fulfill({json:[]});
   const f=path.join(root,u.pathname==='/'?'index.html':u.pathname);
   return fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.fulfill({status:404});
  });
  await p.goto('http://auth.test/',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>window.AuthState?.getState().status==='signed-out');
  await p.evaluate(()=>{document.getElementById('splash-screen')?.remove();document.getElementById('ra-modal-overlay')?.remove();});
  await p.locator('#login-btn').click();
  await p.locator('#login-email').fill('auth-test@example.invalid');
  await p.locator('#login-password').fill('test-password-only');
  await p.locator('#login-form button[type=submit]').click();
  await p.waitForFunction(()=>window.testAlerts?.length);
  console.log('Login response:',await p.evaluate(()=>window.testAlerts));
  const status=await p.evaluate(()=>AuthState.getState().status);
  console.log('AuthState after successful login:',status);
  assert.equal(status,'signed-in','successful login must update the shared auth state');
  await p.waitForFunction(()=>window.UsageTracker?.sessionId);
  assert(visits.some(v=>v.body.p_kind==='login'&&v.authorization==='Bearer test-access-token'),
      'successful login must immediately submit authenticated usage for admin email list');
  await p.locator('#member-center-btn').click();
  await p.locator('#vip-center-overlay button').filter({hasText:'立即订阅'}).first().click();
  assert.equal(await p.locator('#vip-payment-modal').isVisible(),true);
  assert.equal(await p.evaluate(()=>window.testAlerts.some(m=>m.includes('请先登录'))),false);
  await p.evaluate(async()=>{closeVipPaymentModal();await logout();document.getElementById('vip-center-overlay')?.remove();window.testAlerts=[];});
  visits.length=0;
  assert.equal(await p.evaluate(()=>AuthState.getState().status),'signed-out');
  await p.locator('#register-btn').click();
  await p.locator('#register-name').fill('测试用户');
  await p.locator('#register-email').fill('auth-test@example.invalid');
  await p.locator('#register-password').fill('test-password-only');
  await p.locator('#register-confirm-password').fill('test-password-only');
  await p.locator('#send-verify-code').click();
  await p.locator('#register-verify-code').fill('123456');
  await p.locator('#register-submit-btn').click();
  await p.waitForFunction(()=>window.testAlerts.some(m=>m.startsWith('注册成功')));
  assert.equal(await p.evaluate(()=>AuthState.getState().status),'signed-in');
  await p.waitForTimeout(150);
  assert(visits.some(v=>v.body.p_kind==='login'&&v.authorization==='Bearer test-access-token'),
      'OTP registration must immediately submit authenticated usage for admin email list');
  await p.locator('#member-center-btn').click();
  await p.locator('#vip-center-overlay button').filter({hasText:'立即订阅'}).first().click();
  assert.equal(await p.locator('#vip-payment-modal').isVisible(),true);
  await p.reload({waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>AuthState.getState().status==='signed-in');
  console.log('PASS: login/registration submit authenticated admin usage immediately; logout, subscription and reload');
 } finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
