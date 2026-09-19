import { commuteIntent,detourAdvice } from '../lib/commute.mjs';
import { typicalDemand } from '../lib/server/baselines.mjs';
import { crowdLine } from '../lib/routing.mjs';
const home={label:'Home',lat:1.4,lon:103.91},work={label:'Work',lat:1.3,lon:103.78};
const now=Date.parse('2026-09-21T00:00:00Z');
test('offsite calendar takes priority; otherwise morning work, evening home, or manual search',()=>{
  const event={id:'e',title:'Meeting',location:'Library',start:new Date(now+3600000).toISOString(),place:{lat:1.32,lon:103.85}};
  expect(commuteIntent({home,work,events:[event]},now)).toMatchObject({kind:'calendar',destination:event.place});
  expect(commuteIntent({home,work},now).kind).toBe('work');
  expect(commuteIntent({home,work},now+10*3600000).kind).toBe('home');
  expect(commuteIntent({},now)).toBeNull();
  expect(commuteIntent({home,work,events:[{...event,place:work}]},now).kind).toBe('work');
  expect(commuteIntent({home,work,events:[{...event,id:'office',start:new Date(now+600000).toISOString(),place:work},event]},now).event.id).toBe('e');
});
test('historical comparisons are explicitly volume estimates and missing data remains unknown',()=>{
  const hours=Array(24).fill(10);hours[8]=30;hours[18]=100;
  const data={generatedAt:new Date().toISOString(),months:['202608'],profiles:{rail:{NE17:{WEEKDAY:{hours,odHours:hours}}}}};
  expect(typicalDemand(data,'rail','NE17',now,'h')).toMatchObject({expectedLevel:'l',comparison:'more',estimated:true});
  expect(typicalDemand(data,'rail','NE17',now+10*3600000,'l')).toMatchObject({comparison:'less'});
  expect(typicalDemand(data,'rail','NE17',now,null).comparison).toBeNull();
  expect(typicalDemand(data,'rail','NE12',now,'h')).toBeNull();
});
test('crowd-feed line aliases include LRT and extension services',()=>{
  expect(crowdLine('PTL','PE4')).toBe('PLRT');expect(crowdLine('STL','SE1')).toBe('SLRT');
  expect(crowdLine('CCL','CE1')).toBe('CEL');expect(crowdLine('EWL','CG2')).toBe('CGL');
});
test('detour notifications require actionable change, including rain and crowd forecasts',()=>{
  const original={legs:[{mode:'cycle',from:{},to:{}}]};
  const bus={legs:[{mode:'bus',service:'50',from:{code:'1'},to:{code:'2'}}],durationSeconds:600};
  expect(detourAdvice(original,{weather:{wet:true},journeys:[bus]})).toMatchObject({title:'Rain on your route'});
  expect(detourAdvice(bus,{weather:{wet:false},journeys:[bus]})).toBeNull();
  expect(detourAdvice({...bus,affected:true},{journeys:[{...bus,affected:true}]})).toBeNull();
  const later={...bus,departureOffsetMinutes:20,crowdLevel:'l'};
  expect(detourAdvice({...bus,affected:true},{journeys:[later]}).body).toMatch(/20 min later/);
});
