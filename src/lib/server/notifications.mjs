import webpush from 'web-push';
import { randomBytes,createHash } from 'node:crypto';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pool } from './spatial.mjs';
let init,keysPromise;
const hash=value=>createHash('sha256').update(value).digest('hex');
export function allowedNotificationOrigin(origin,requestUrl) {
  return !origin || origin===new URL(process.env.PUBLIC_APP_URL || requestUrl).origin;
}
export function pushKeys() {
  return keysPromise ||= (async()=>{
    if(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) return {publicKey:process.env.VAPID_PUBLIC_KEY,privateKey:process.env.VAPID_PRIVATE_KEY};
    const file=path.join(process.cwd(),'.local/push-keys.json');
    try{return JSON.parse(await readFile(file,'utf8'));}catch{}
    await mkdir(path.dirname(file),{recursive:true});const keys=webpush.generateVAPIDKeys();
    try{await writeFile(file,JSON.stringify(keys),{flag:'wx',mode:0o600});return keys;}catch(e){if(e.code==='EEXIST')return JSON.parse(await readFile(file,'utf8'));throw e;}
  })();
}
export async function initWatches() {
  if(!init) init=pool.query(`CREATE TABLE IF NOT EXISTS commute_watches (
    id text PRIMARY KEY, token_hash text NOT NULL, subscription jsonb NOT NULL, config jsonb NOT NULL,
    last_advice text, last_day text, last_journey jsonb, updated_at timestamptz NOT NULL DEFAULT now()
  )`).catch(e=>{init=null;throw e;});
  return init;
}
export async function monitorActive() {try{const state=JSON.parse(await readFile(path.join(process.cwd(),'.local/monitor-status.json'),'utf8'));return Date.now()-Date.parse(state.checkedAt)<5*60000;}catch{return false;}}
export function validSubscription(s) {
  try {const url=new URL(s.endpoint);return url.protocol==='https:' && (/^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com)$/.test(url.hostname) || url.hostname.endsWith('.notify.windows.com') || url.hostname.endsWith('.push.apple.com')) && /^[A-Za-z0-9_-]{80,120}$/.test(s.keys?.p256dh) && /^[A-Za-z0-9_-]{20,30}$/.test(s.keys?.auth);}catch{return false;}
}
export async function saveWatch(subscription,config,credentials={}) {
  if(!validSubscription(subscription))throw new Error('Unsupported push subscription.');
  credentials ||= {};
  await initWatches();
  const id=credentials.id || randomBytes(16).toString('hex'),token=credentials.token || randomBytes(32).toString('hex');
  if(credentials.id) {
    const result=await pool.query('UPDATE commute_watches SET subscription=$3,config=$4,updated_at=now() WHERE id=$1 AND token_hash=$2 RETURNING id',[id,hash(token),subscription,config]);
    if(!result.rowCount)throw new Error('Notification subscription expired. Disable and enable notifications again.');
  } else await pool.query('INSERT INTO commute_watches(id,token_hash,subscription,config) VALUES($1,$2,$3,$4)',[id,hash(token),subscription,config]);
  return {id,token};
}
export async function deleteWatch(id,token) {await initWatches();await pool.query('DELETE FROM commute_watches WHERE id=$1 AND token_hash=$2',[id,hash(token)]);}
export async function sendPush(subscription,advice) {
  const keys=await pushKeys();
  return webpush.sendNotification(subscription,JSON.stringify({title:advice.title,body:advice.body,url:'/',tag:'commute-detour'}),{TTL:300,vapidDetails:{subject:process.env.VAPID_SUBJECT || 'https://example.com/wayfinder',publicKey:keys.publicKey,privateKey:keys.privateKey}});
}
