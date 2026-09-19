jest.mock('web-push',()=>({sendNotification:jest.fn(async()=>({statusCode:201})),generateVAPIDKeys:jest.fn()}));
jest.mock('../lib/server/spatial.mjs',()=>({pool:{query:jest.fn(async()=>({rows:[],rowCount:1}))}}));
import webpush from 'web-push';
import { validSubscription,saveWatch,sendPush,deleteWatch,allowedNotificationOrigin } from '../lib/server/notifications.mjs';
import { pool } from '../lib/server/spatial.mjs';
const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:'A'.repeat(87),auth:'A'.repeat(22)}};
test('notification requests use the configured public origin behind the cloud proxy',()=>{
  const previous=process.env.PUBLIC_APP_URL;
  process.env.PUBLIC_APP_URL='https://commute.example.com';
  expect(allowedNotificationOrigin('https://commute.example.com','http://web:3000/api/notifications')).toBe(true);
  expect(allowedNotificationOrigin('https://elsewhere.example','http://web:3000/api/notifications')).toBe(false);
  if(previous===undefined)delete process.env.PUBLIC_APP_URL;else process.env.PUBLIC_APP_URL=previous;
});
test('only recognised HTTPS push services are accepted',()=>{
  expect(validSubscription(subscription)).toBe(true);
  expect(validSubscription({...subscription,endpoint:'http://localhost:8000'})).toBe(false);
  expect(validSubscription({...subscription,endpoint:'https://example.com/private'})).toBe(false);
});
test('subscription management uses an unguessable token and authenticated updates/deletion',async()=>{
  const credentials=await saveWatch(subscription,{home:{lat:1.4,lon:103.9}},null);
  expect(credentials.token).toHaveLength(64);expect(credentials.id).toHaveLength(32);
  await saveWatch(subscription,{},credentials);await deleteWatch(credentials.id,credentials.token);
  expect(pool.query.mock.calls.some(([sql])=>sql.includes('token_hash=$2'))).toBe(true);
  expect(JSON.stringify(pool.query.mock.calls)).not.toContain(credentials.token);
});
test('push delivery uses a brief detour payload with an expiry and no calendar title',async()=>{
  process.env.VAPID_PUBLIC_KEY='test-public';process.env.VAPID_PRIVATE_KEY='test-private';
  await sendPush(subscription,{title:'Rain on your route',body:'Bus 381 → NE · 70 min'});
  const [,payload,options]=webpush.sendNotification.mock.calls[0];
  expect(JSON.parse(payload)).toMatchObject({title:'Rain on your route',url:'/',tag:'commute-detour'});expect(options.TTL).toBe(300);
});
