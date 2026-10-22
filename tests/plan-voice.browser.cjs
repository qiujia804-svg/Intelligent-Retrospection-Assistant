const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME});
 try{for(const mode of ['standard','prefixed','unsupported']){
  const p=await b.newPage();p.setDefaultTimeout(8000);
  await p.addInitScript(mode=>{
   localStorage.setItem('ra_guide_acknowledged','true');
   class Recognition{
    constructor(){window.testRecognition=this;this.aborted=false;}
    start(){this.onstart?.();}stop(){if(this.finalOnStop)this.emit(this.finalOnStop);this.onend?.();}abort(){this.aborted=true;this.onend?.();}
    emit(text,final=true){const r=[{transcript:text}];r.isFinal=final;this.onresult?.({resultIndex:0,results:[r]});}
   }
   Object.defineProperty(window,'SpeechRecognition',{configurable:true,value:mode==='standard'?Recognition:undefined});
   Object.defineProperty(window,'webkitSpeechRecognition',{configurable:true,value:mode==='prefixed'?Recognition:undefined});
  },mode);
  await p.route('**/*',r=>{
   const u=new URL(r.request().url());if(u.hostname!=='voice.test')return r.abort();
   if(u.pathname==='/api/ai-plan')return r.fulfill({status:503,json:{error:'测试生成失败，可重试'}});
   if(u.pathname.startsWith('/cb/'))return r.fulfill({json:[]});
   const f=path.join(root,u.pathname==='/'?'index.html':u.pathname);
   return fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.fulfill({status:404});
  });
  await p.goto('http://voice.test/',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1000);
  await p.evaluate(()=>{document.getElementById('splash-screen')?.remove();document.getElementById('ra-modal-overlay')?.remove();AuthState.getState=()=>({status:'signed-in'});openVipCenter();document.getElementById('vip-center-overlay')?.remove();document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));document.getElementById('plan-content').classList.add('active');});
  await p.locator('.ai-plan-entry').click();
  const voice=p.locator('#ai-plan-voice-button'),input=p.locator('#ai-plan-input'),generate=p.locator('#ai-plan-generate');
  if(mode==='unsupported'){
   assert.equal(await voice.isDisabled(),true);await input.fill('仍可打字');assert.equal(await generate.isEnabled(),true);
  }else{
   const hold = async () => {
    if(mode==='prefixed') return voice.dispatchEvent('pointerdown',{pointerType:'touch',pointerId:7,button:0,isPrimary:true});
    const box=await voice.boundingBox();await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();
   };
   const release = () => mode==='prefixed'
    ? voice.dispatchEvent('pointerup',{pointerType:'touch',pointerId:7,button:0,isPrimary:true}) : p.mouse.up();
   await input.fill('原有计划');await hold();assert.equal(await generate.isDisabled(),true);
   assert.equal(await p.evaluate(()=>testRecognition.lang),'zh-CN');
   await p.evaluate(()=>testRecognition.emit('临时识别',false));assert.equal(await input.inputValue(),'原有计划');
   await p.evaluate(()=>testRecognition.emit('九点写方案'));await p.evaluate(()=>testRecognition.emit('九点写方案'));
   assert.equal(await input.inputValue(),'原有计划\n九点写方案');
   await release();assert.equal(await generate.isEnabled(),true);
   await hold();await p.evaluate(()=>testRecognition.finalOnStop='松开后填入');
   if(mode==='standard')await p.mouse.move(5,5);
   await release();assert.match(await input.inputValue(),/松开后填入/);
   await input.fill('原有计划\n九点写方案');
   await hold();await p.evaluate(()=>testRecognition.onerror({error:'not-allowed'}));await release();
   assert.match(await p.locator('#ai-plan-voice-status').innerText(),/麦克风权限/);assert.equal(await generate.isEnabled(),true);
   await hold();await p.evaluate(()=>document.getElementById('ai-plan-dialog').close());
   await p.waitForFunction(()=>testRecognition.aborted);
   await release();
   assert.equal(await p.evaluate(()=>testRecognition.aborted),true);
   await p.evaluate(()=>testRecognition.emit('关闭后不得填入'));
   assert.equal(await input.inputValue(),'原有计划\n九点写方案');
   await p.locator('.ai-plan-entry').click();
   await input.evaluate(e=>e.maxLength=12);await input.fill('已有内容');await hold();
   await p.evaluate(()=>testRecognition.emit('这是很长的一段语音识别结果'));
   await release();
   assert.equal((await input.inputValue()).length,12);assert.equal(await generate.isEnabled(),true);
   await generate.click();await p.waitForFunction(()=>!document.getElementById('ai-plan-input').disabled);
   assert.equal(await voice.isEnabled(),true);
   await voice.focus();await p.keyboard.down('Space');assert.equal(await generate.isDisabled(),true);
   await p.keyboard.up('Space');assert.equal(await generate.isEnabled(),true);
  }
  await p.close();
 }
 console.log('PASS: mouse/touch hold-to-talk and release, keyboard hold, append/dedup, errors, cleanup, generation');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
