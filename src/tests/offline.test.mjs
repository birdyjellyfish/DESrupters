import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
test('service worker intercepts POST route and serves only its matching cached payload offline',async()=>{
  const listeners={}, stores=new Map();
  const caches={open:async name=>{if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return {put:async(k,v)=>store.set(k.url,v.clone()),match:async k=>store.get(k.url)?.clone(),keys:async()=>[...store.keys()].map(k=>new Request(k)),delete:async k=>store.delete(k.url)};}};
  const payload={generatedAt:new Date().toISOString(),journeys:[{id:'real-journey'}]};
  const fetch=jest.fn(async()=>Response.json(payload));
  const context={self:{location:{origin:'https://wayfinder.test'},addEventListener:(name,fn)=>listeners[name]=fn},caches,fetch,Request,Response,URL,crypto:webcrypto,TextEncoder,Date};
  vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),context);
  const send=async body=>{let response;listeners.fetch({request:new Request('https://wayfinder.test/api/route',{method:'POST',body:JSON.stringify(body)}),respondWith:p=>response=p});return response;};
  const first=await send({origin:'A',destination:'B'});expect((await first.json()).journeys[0].id).toBe('real-journey');
  fetch.mockRejectedValue(new Error('offline'));
  const saved=await send({origin:'A',destination:'B'});expect(saved.headers.get('X-Wayfinder-Stale')).toBe('true');expect((await saved.json()).offline).toBe(true);
  expect((await send({origin:'A',destination:'C'})).status).toBe(503);
});
test('push displays a detour and tapping it refreshes the existing app',async()=>{
  const listeners={},showNotification=jest.fn(async()=>{}),postMessage=jest.fn(),focus=jest.fn(async()=>{});
  const self={location:{origin:'https://wayfinder.test'},addEventListener:(name,fn)=>listeners[name]=fn,registration:{showNotification},clients:{matchAll:async()=>[{url:'https://wayfinder.test/',focus,postMessage}],openWindow:jest.fn()}};
  vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),{self,URL});
  let work;listeners.push({data:{json:()=>({title:'Disruption on your route',body:'Cycle to Punggol MRT'})},waitUntil:p=>work=p});await work;
  expect(showNotification).toHaveBeenCalledWith('Disruption on your route',expect.objectContaining({body:'Cycle to Punggol MRT'}));
  listeners.notificationclick({notification:{close:jest.fn()},waitUntil:p=>work=p});await work;
  expect(focus).toHaveBeenCalled();expect(postMessage).toHaveBeenCalledWith({type:'REFRESH_COMMUTE'});
});
