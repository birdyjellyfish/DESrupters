import { readFile } from 'node:fs/promises';
import path from 'node:path';
let snapshot, loadedAt = 0;
export async function baselineData() {
  if (Date.now()-loadedAt<60000) return snapshot;
  loadedAt=Date.now();
  try {snapshot=JSON.parse(await readFile(path.join(process.cwd(),'data/crowd-baselines.json'),'utf8'));} catch {snapshot=null;}
  return snapshot;
}
export function typicalDemand(data, mode, code, at, level) {
  if (!data || Date.now()-Date.parse(data.generatedAt)>100*86400000) return null;
  const date=new Date(at+8*3600000),day=[0,6].includes(date.getUTCDay())?'WEEKENDS/HOLIDAY':'WEEKDAY',hour=date.getUTCHours();
  const group=data.profiles?.[mode]?.[code]?.[day];
  if (!group) return null;
  const hours=group.hours?.some(n=>n>0)?group.hours:group.odHours;
  const peak=Math.max(...(hours || []));
  if (!peak || !Number.isFinite(hours[hour])) return null;
  const ratio=hours[hour]/peak,expectedLevel=ratio<.35?'l':ratio<.7?'m':'h';
  const order={l:0,m:1,h:2},difference=level in order?order[level]-order[expectedLevel]:null;
  return {expectedLevel,comparison:difference===null?null:difference>0?'more':difference<0?'less':'usual',estimated:true,
    label:difference===null?'Typical demand estimate':difference>0?'More crowded than normal':difference<0?'Less crowded than normal':'Around normal crowding',
    source:`LTA monthly passenger volumes (${data.months.join(', ')})`,hour,dayType:day,
    peakShare:Math.round(ratio*100),odVolume:group.odHours?.[hour] ?? null,
    explanation:'Estimate: this hour’s passenger flow relative to this stop’s busiest hour; not historical platform density or occupancy of this bus. Weekends/holidays are grouped; weekday public holidays may differ.'};
}
