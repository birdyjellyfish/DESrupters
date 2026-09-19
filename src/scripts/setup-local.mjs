import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
try {await readFile('.env');console.log('.env already exists; left unchanged.');}
catch(e) {
  if(e.code!=='ENOENT')throw e;
  const password=randomBytes(24).toString('hex');
  const defaults={DATABASE_URL:`postgresql://wayfinder:${password}@localhost:5433/wayfinder`,POSTGRES_PASSWORD:password,REDIS_URL:'redis://localhost:6379',VALHALLA_URL:'http://localhost:8002',VAPID_SUBJECT:'https://example.com/wayfinder'};
  const template=await readFile(new URL('../../.env.example',import.meta.url),'utf8');
  await writeFile('.env',template.replace(/^(\w+)=$/gm,(line,key)=>defaults[key]?`${key}=${defaults[key]}`:line),{flag:'wx',mode:0o600});
  console.log('Created private .env with matching local service settings. Fill in the three API/map credentials.');
}
