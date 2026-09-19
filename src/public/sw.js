const CACHE = 'wayfinder-journey-v6';
const JOURNEYS = 'wayfinder-routes-v3';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/', '/branding/wayfinder-bird-512.png'])));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('wayfinder-') && ![CACHE,JOURNEYS].includes(n)).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});
async function routeKey(request) {
  const body = await request.clone().text();
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body));
  const hash = Array.from(new Uint8Array(digest),b => b.toString(16).padStart(2,'0')).join('');
  return new Request(`${self.location.origin}/_offline/journey/${hash}`);
}
async function routeRequest(request) {
  const key = await routeKey(request), cache = await caches.open(JOURNEYS);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(key,response.clone());
      const keys = await cache.keys();
      await Promise.all(keys.slice(0,Math.max(0,keys.length-10)).map(k => cache.delete(k)));
    }
    return response;
  } catch {
    const saved = await cache.match(key);
    if (!saved) return Response.json({error:'Offline. No saved journey matches these locations and preferences.'},{status:503});
    const data = await saved.json();
    if (!data.generatedAt || Date.now()-Date.parse(data.generatedAt)>7*86400000) return Response.json({error:'The saved journey has expired. Reconnect to plan again.'},{status:503});
    return Response.json({...data,offline:true},{headers:{'X-Wayfinder-Stale':'true','Cache-Control':'no-store'}});
  }
}
self.addEventListener('message', event => {
  if (event.data?.type === 'CLEAR_JOURNEYS') event.waitUntil(caches.delete(JOURNEYS));
});
self.addEventListener('push',event=>{
  let message;try{message=event.data?.json();}catch{return;}
  if(!message?.body)return;
  event.waitUntil(self.registration.showNotification(message.title || 'Your commute',{body:message.body,tag:message.tag || 'commute-detour',data:{url:'/'}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const current=windows.find(w=>new URL(w.url).origin===self.location.origin);if(current){await current.focus();current.postMessage({type:'REFRESH_COMMUTE'});}else await self.clients.openWindow('/');})());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.method === 'POST' && url.pathname === '/api/route') { event.respondWith(routeRequest(event.request)); return; }
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok && (event.request.mode === 'navigate' || url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/vendor/'))) {
        const cache = await caches.open(CACHE);
        await cache.put(event.request,response.clone());
      }
      return response;
    } catch {
      return (await caches.match(event.request)) || (event.request.mode === 'navigate' ? await caches.match('/') : null) || Response.error();
    }
  })());
});
