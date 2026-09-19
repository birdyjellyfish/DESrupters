import { Unzip, UnzipInflate } from 'fflate';
import { parse } from 'csv-parse';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
const profiles={rail:{},bus:{}},months=new Set(),sources=[];
const requested=process.argv[2];
if(requested && !/^\d{6}$/.test(requested)) throw new Error('Optional month must be YYYYMM.');
if(!process.env.LTA_ACCOUNT_KEY) throw new Error('Load .env with --env-file=.env.');
for(const endpoint of ['Train','Bus','ODTrain','ODBus']) {
  const response=await fetch(`https://datamall2.mytransport.sg/ltaodataservice/PV/${endpoint}${requested?'?Date='+requested:''}`,{headers:{AccountKey:process.env.LTA_ACCOUNT_KEY},signal:AbortSignal.timeout(20000)});
  const data=await response.json(),url=new URL(data.value?.[0]?.Link);
  if(!response.ok || url.protocol!=='https:' || !/(^|\.)amazonaws\.com$/.test(url.hostname)) throw new Error(`Invalid ${endpoint} download response`);
  const download=await fetch(url,{signal:AbortSignal.timeout(180000)});
  if(!download.ok) throw new Error(`${endpoint} download failed`);
  const mode=endpoint.includes('Train')?'rail':'bus',od=endpoint.startsWith('OD');
  let count=0;const completions=[];
  const unzip=new Unzip(file=>{
    if(!file.name.endsWith('.csv')) return;
    const parser=parse({columns:true,bom:true,skip_empty_lines:true,trim:true});
    completions.push(new Promise((resolve,reject)=>{parser.on('end',resolve);parser.on('error',reject);}));
    parser.on('data',r=>{
      const hour=Number(r.TIME_PER_HOUR),day=r.DAY_TYPE,code=String(od?r.ORIGIN_PT_CODE:r.PT_CODE);
      if(!Number.isInteger(hour)||hour<0||hour>23||!['WEEKDAY','WEEKENDS/HOLIDAY'].includes(day)||!code) return;
      if(r.YEAR_MONTH) months.add(r.YEAR_MONTH);
      const entry=(profiles[mode][code] ||= {}),group=(entry[day] ||= {hours:Array(24).fill(0),odHours:Array(24).fill(0)});
      const value=Number(od?r.TOTAL_TRIPS:r.TOTAL_TAP_IN_VOLUME);
      if(Number.isFinite(value)&&value>=0) group[od?'odHours':'hours'][hour]+=value;
      count++;
    });
    file.ondata=(error,chunk,final)=>{if(error)parser.destroy(error);else {parser.write(Buffer.from(chunk));if(final)parser.end();}};
    file.start();
  });
  unzip.register(UnzipInflate);
  for await(const chunk of download.body) unzip.push(new Uint8Array(chunk));
  unzip.push(new Uint8Array(),true);await Promise.all(completions);
  if(!count) throw new Error(`${endpoint} contained no valid rows; existing baseline retained.`);
  sources.push({endpoint:`PV/${endpoint}`,rows:count});console.log(`${endpoint}: ${count} rows aggregated`);
}
// Interchange volume codes can contain multiple MRT/LRT codes.
for(const mode of ['rail','bus']) for(const [code,value] of Object.entries(profiles[mode])) for(const alias of code.split(/[\/\s-]+/)) if(alias && alias!==code) profiles[mode][alias] ||= value;
const dir=path.join(process.cwd(),'data');await mkdir(dir,{recursive:true});
const target=path.join(dir,'crowd-baselines.json'),temp=target+'.tmp';
await writeFile(temp,JSON.stringify({version:1,generatedAt:new Date().toISOString(),months:[...months],sources,profiles}));await rename(temp,target);
console.log(`Saved baseline for ${Object.keys(profiles.rail).length} stations and ${Object.keys(profiles.bus).length} bus stops.`);
