import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const children=new Set();
let stopping=false;
function stop(code=0) {
  if(stopping)return;
  stopping=true;
  process.exitCode=code;
  for(const child of children)child.kill('SIGTERM');
  if(!children.size)return;
  const deadline=setTimeout(()=>{
    for(const child of children)child.kill('SIGKILL');
  },8000);
  deadline.unref();
}
function launch(command,args) {
  const child=spawn(command,args,{stdio:'inherit'});
  children.add(child);
  child.on('error',()=>{children.delete(child);console.error(`Could not start ${command}`);stop(1);});
  child.on('exit',(code,signal)=>{
    children.delete(child);
    if(!stopping){console.error(`${command} exited (${signal || code}); stopping the instance.`);stop(1);}
  });
  return child;
}
process.on('SIGTERM',()=>stop());
process.on('SIGINT',()=>stop());

try {
  if(process.env.K_SERVICE && !process.env.DATABASE_URL)throw new Error('Set DATABASE_URL to a persistent PostgreSQL/PostGIS database.');
  const monitor=process.env.RUN_COMMUTE_MONITOR==='true';
  if(monitor && (!process.env.DATABASE_URL || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY)) {
    throw new Error('The monitor requires DATABASE_URL and a stable VAPID key pair supplied at runtime.');
  }
  const port=Number(process.env.PORT || 8080);
  const threads=Number(process.env.VALHALLA_THREADS || 2);
  if(!Number.isInteger(port) || port<1 || port>65535 || port===8002)throw new Error('Invalid HTTP PORT.');
  if(!Number.isInteger(threads) || threads<1 || threads>8)throw new Error('VALHALLA_THREADS must be 1–8.');
  process.env.VALHALLA_URL='http://127.0.0.1:8002';
  launch('valhalla_service',['/app/data/valhalla/cloudrun.json',String(threads)]);
  let ready=false;
  for(let attempt=0;attempt<90 && !stopping;attempt++) {
    try {ready=(await fetch(`${process.env.VALHALLA_URL}/status`,{signal:AbortSignal.timeout(1000)})).ok;}catch{}
    if(ready)break;
    await delay(1000);
  }
  if(!stopping) {
    if(!ready)throw new Error('Valhalla did not become ready within the startup window.');
    launch(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','0.0.0.0','--port',String(port)]);
    if(monitor)launch(process.execPath,['scripts/monitor-commutes.mjs']);
  }
} catch(error) {console.error(error.message);stop(1);}
