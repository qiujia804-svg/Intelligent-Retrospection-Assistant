const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
 const browser = await chromium.launch({headless:true, executablePath:process.env.TEST_CHROME});
 try {
  for (const mobile of [false, true]) {
  const page = await browser.newPage(mobile ? {viewport:{width:390,height:844},isMobile:true,hasTouch:true} : {});
  page.setDefaultTimeout(6000);
  await page.route('**/*', route => {
   const u = new URL(route.request().url());
   if(u.hostname !== 'subscription.test') return route.fulfill({contentType:'text/javascript', body:''});
   const f = path.join(root, u.pathname === '/' ? 'index.html' : u.pathname);
   return fs.existsSync(f) && fs.statSync(f).isFile() ? route.fulfill({path:f}) : route.fulfill({status:404});
  });
  await page.addInitScript(() => {
   window.Chart = class {constructor(ctx,c){Object.assign(this,c)} update(){} destroy(){}};
   window.alert = () => {};
  });
  await page.goto('http://subscription.test/', {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  for (const locked of [false, true]) {
  await page.evaluate(locked => {
   document.getElementById('ra-modal-overlay')?.remove();
   window.AuthState.getState = () => ({status:'signed-in'});
   openVipCenter();
   document.body.classList.toggle('app-locked', locked);
  }, locked);
  for (const [index, amount] of ['19.9','299','399'].entries()) {
  await page.locator('#vip-center-overlay button').filter({hasText:'立即订阅'}).nth(index).click();
  assert.equal(await page.locator('#vip-payment-amount').innerText(),amount);
  assert.equal(await page.evaluate(() => {
   const p=document.getElementById('vip-payment-modal'), r=p.getBoundingClientRect();
   return p.contains(document.elementFromPoint(Math.min(r.right-1,innerWidth/2),Math.min(r.bottom-1,innerHeight/2)));
  }),true, 'payment must be above membership center');
  await page.locator('.vip-method-btn[data-method="alipay"]').click();
  assert.equal(await page.locator('#vip-qr-alipay').isVisible(),true);
  assert.equal(await page.locator('#vip-qr-alipay img').evaluate(e=>e.complete && e.naturalWidth>0),true);
  await page.locator('.vip-method-btn[data-method="wechat"]').click();
  assert.equal(await page.locator('#vip-qr-wechat').isVisible(),true);
  assert.equal(await page.locator('#vip-qr-wechat img').evaluate(e=>e.complete && e.naturalWidth>0),true);
  await page.locator('#vip-payment-close').click();
  assert.equal(await page.locator('#vip-payment-modal').isVisible(),false);
  }
  }
  // Guest guard still asks for sign-in rather than opening payment.
  await page.evaluate(() => { window.AuthState.getState=()=>({status:'signed-out'}); });
  await page.locator('#vip-center-overlay button').filter({hasText:'立即订阅'}).first().click();
  assert.equal(await page.locator('#vip-payment-modal').isVisible(),false);
  await page.close();
  }
  console.log('PASS: desktop/mobile, locked/unlocked, all three plans, QR images, method switch, close, guest guard');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
