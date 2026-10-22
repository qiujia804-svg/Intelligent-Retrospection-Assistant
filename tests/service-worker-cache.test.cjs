const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const handlers={},data=new Map();let failed=false;const fetched=[];
 const cache={put:async(k,v)=>{data.set(typeof k==='string'?k:k.url,v.clone());},match:async k=>data.get(typeof k==='string'?k:k.url)?.clone()};
 const context={console:{log(){},warn(){},error(){}},URL,Response,AbortController,setTimeout,clearTimeout,
 self:{location:{origin:'https://app.test'},addEventListener:(k,f)=>handlers[k]=f,skipWaiting:async()=>{},clients:{claim:async()=>{}}},
 caches:{open:async()=>cache,keys:async()=>[],delete:async()=>true,match:cache.match},
 fetch:async r=>{const url=typeof r==='string'?r:r.url;fetched.push(url);if(failed)throw Error('offline');return new Response('fresh:'+url);}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../service-worker.js'),'utf8'),context);
 return {data,fetched,handlers,fail:()=>failed=true,request:async(path,mode)=>{let result;handlers.fetch({request:{url:'https://app.test'+path,method:'GET',mode},respondWith:p=>result=p});return result;}};
}
test('scripts and pages use network first, retain offline fallback',async()=>{
 const s=setup();s.data.set('https://app.test/cloud-auth.js',new Response('old'));
 assert.equal(await(await s.request('/cloud-auth.js')).text(),'fresh:https://app.test/cloud-auth.js');
 s.fail();assert.equal(await(await s.request('/cloud-auth.js')).text(),'fresh:https://app.test/cloud-auth.js');
});
test('account requests never read or write cached session responses',async()=>{
 const s=setup();s.data.set('https://app.test/cb/.cloud/auth/v1/user/me',new Response('other-user'));
 assert.equal(await(await s.request('/cb/.cloud/auth/v1/user/me')).text(),'fresh:https://app.test/cb/.cloud/auth/v1/user/me');
 s.fail();await assert.rejects(s.request('/cb/.cloud/auth/v1/user/me'),/offline/);
});
test('worker install does not wait on external CDN resources',async()=>{
 const s=setup();let done;s.handlers.install({waitUntil:p=>done=p});await done;
 assert(s.fetched.length>0);assert(s.fetched.every(url=>url.startsWith('./')));
});
