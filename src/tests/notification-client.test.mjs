/** @jest-environment jsdom */
import {saveNotifications,hasWatch,hasLocalAlerts,showDetourNotification,disableNotifications} from '../lib/notifications.mjs';
test('background watch excludes calendar titles and unresolved locations before transmission',async()=>{
  localStorage.clear();
  Object.defineProperty(window,'Notification',{configurable:true,value:{permission:'granted'}});
  Object.defineProperty(window,'PushManager',{configurable:true,value:function(){}});
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{ready:Promise.resolve({pushManager:{getSubscription:async()=>({toJSON:()=>({endpoint:'mock'})})}})}});
  global.fetch=jest.fn(async()=>({ok:true,json:async()=>({id:'id',token:'token',monitorActive:false})}));
  await saveNotifications({home:{lat:1.4,lon:103.9},work:{lat:1.3,lon:103.8},events:[{id:'e',title:'Private meeting',location:'Private venue',start:'2026-09-21T00:00:00Z',place:{lat:1.31,lon:103.81}},{id:'unresolved',title:'Other',location:'Unknown'}]});
  const sent=JSON.parse(fetch.mock.calls[0][1].body);
  expect(sent.config.events).toEqual([{id:'e',start:'2026-09-21T00:00:00Z',place:{lat:1.31,lon:103.81}}]);
  expect(JSON.stringify(sent)).not.toContain('Private');
});

const config={home:{lat:1.4,lon:103.9},work:{lat:1.3,lon:103.8}};
function setupPush(subscribe) {
  localStorage.clear();
  Object.defineProperty(window,'Notification',{configurable:true,value:{permission:'granted',requestPermission:async()=>'granted'}});
  Object.defineProperty(window,'PushManager',{configurable:true,value:function(){}});
  const registration={pushManager:{getSubscription:jest.fn(async()=>null),subscribe},showNotification:jest.fn(async()=>{})};
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{ready:Promise.resolve(registration),getRegistration:async()=>registration}});
  const key=btoa(String.fromCharCode(4)+String.fromCharCode(1).repeat(64)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  global.fetch=jest.fn(async(_,options)=>({ok:true,json:async()=>options?.method==='POST'?{id:'id',token:'token',monitorActive:true}:{publicKey:key}}));
  return registration;
}
test('push service failure is retried once and falls back to page-open alerts without a false subscription',async()=>{
  const subscribe=jest.fn(async()=>{throw new DOMException('Registration failed - push service error','AbortError');});
  const registration=setupPush(subscribe);
  expect(await saveNotifications(config,true)).toMatchObject({mode:'foreground',monitorActive:false});
  expect(subscribe).toHaveBeenCalledTimes(2);expect(hasWatch()).toBe(false);expect(hasLocalAlerts()).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
  await showDetourNotification({title:'Rain',body:'Take the bus'});expect(registration.showNotification).toHaveBeenCalledTimes(1);
  await disableNotifications();expect(hasLocalAlerts()).toBe(false);
});
test('a transient push service failure recovers and saves the background watch',async()=>{
  const subscribe=jest.fn().mockRejectedValueOnce(new DOMException('push service error','AbortError')).mockResolvedValueOnce({toJSON:()=>({endpoint:'mock'})});
  setupPush(subscribe);
  expect(await saveNotifications(config,true)).toEqual({mode:'background',monitorActive:true});
  expect(hasWatch()).toBe(true);expect(hasLocalAlerts()).toBe(false);
});
test('invalid server keys never reach the browser push service',async()=>{
  const subscribe=jest.fn();setupPush(subscribe);fetch.mockResolvedValue({ok:true,json:async()=>({publicKey:'invalid'})});
  await expect(saveNotifications(config,true)).rejects.toThrow('key is invalid');expect(subscribe).not.toHaveBeenCalled();expect(hasLocalAlerts()).toBe(false);
});
