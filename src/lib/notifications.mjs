const WATCH='wayfinder-push-watch-v1';
const LOCAL='wayfinder-local-notifications-v1';
export function hasWatch(){try{return Boolean(localStorage.getItem(WATCH));}catch{return false;}}
export function hasLocalAlerts(){try{return localStorage.getItem(LOCAL)==='enabled';}catch{return false;}}
async function readyWorker() {
  let timer;
  try{return await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Notifications are still starting. Reload this page and try again.')),10000);})]);}
  finally{clearTimeout(timer);}
}
export async function saveNotifications(config,ask=false) {
  if(!config.home || (!config.work && !config.events?.some(e=>e.place)))throw new Error('Set home and work, or a located calendar event, first.');
  if(!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window))throw new Error('This browser does not support background notifications. In-app detour alerts still work.');
  const permission=ask?await Notification.requestPermission():Notification.permission;
  if(permission!=='granted')throw new Error('Notifications are not enabled. You can change this in browser settings.');
  const registration=await readyWorker();
  let subscription=await registration.pushManager.getSubscription();
  if(!subscription) {
    const r=await fetch('/api/notifications'),data=await r.json();
    if(!r.ok)throw new Error('Could not load notification settings. Check the app server and try again.');
    if(typeof data.publicKey!=='string' || !/^[A-Za-z0-9_-]+$/.test(data.publicKey))throw new Error('The server notification key is invalid.');
    const encoded=data.publicKey.replace(/-/g,'+').replace(/_/g,'/');
    const key=Uint8Array.from(atob(encoded+'='.repeat((4-encoded.length%4)%4)),c=>c.charCodeAt(0));
    if(key.length!==65 || key[0]!==4)throw new Error('The server notification key is invalid.');
    try {
      try{subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});}
      catch(e){
        if(e.name!=='AbortError' && !/push service|network/i.test(e.message))throw e;
        // A registration can complete despite an interrupted browser response.
        subscription=await registration.pushManager.getSubscription();
        if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
      }
    } catch(e) {
      if(e.name==='AbortError' || e.name==='NotSupportedError' || /push service|network/i.test(e.message)) {
        if(ask)localStorage.setItem(LOCAL,'enabled');
        return {mode:'foreground',monitorActive:false,message:'Background notifications could not register with your browser’s push service. Alerts still work while this page is open. Check site notification permissions and any browser or network restrictions, then retry.'};
      }
      throw new Error(e.name==='NotAllowedError'?'Allow notifications for this site in your browser settings, then retry.':'Could not register notifications. Reload this page and try again.');
    }
  }
  let credentials;try{credentials=JSON.parse(localStorage.getItem(WATCH) || 'null');}catch{}
  const sharedConfig={...config,events:(config.events || []).filter(e=>e.place).map(({id,start,place})=>({id,start,place}))};
  const response=await fetch('/api/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:subscription.toJSON(),config:sharedConfig,credentials})});
  const data=await response.json();if(!response.ok)throw new Error(data.error);
  localStorage.setItem(WATCH,JSON.stringify(data));
  localStorage.removeItem(LOCAL);
  return {mode:'background',monitorActive:data.monitorActive};
}
export async function disableNotifications() {
  const saved=JSON.parse(localStorage.getItem(WATCH) || 'null');
  if(saved){const response=await fetch('/api/notifications',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify(saved)});if(!response.ok)throw new Error('Could not disable the server reminder. Try again while online.');}
  if(navigator.serviceWorker){const registration=await navigator.serviceWorker.getRegistration();await (await registration?.pushManager.getSubscription())?.unsubscribe();}
  localStorage.removeItem(WATCH);
  localStorage.removeItem(LOCAL);
}
export async function showDetourNotification(advice) {
  if((!hasWatch() && !hasLocalAlerts()) || !('Notification' in window) || Notification.permission!=='granted')return;
  const registration=await navigator.serviceWorker.ready;
  await registration.showNotification(advice.title,{body:advice.body,tag:'commute-detour',data:{url:'/'}});
}
