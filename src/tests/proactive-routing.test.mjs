jest.mock('../lib/server/onemap.mjs',()=>({journeyCandidates:jest.fn()}));
jest.mock('../lib/server/valhalla.mjs',()=>({refineWalking:jest.fn(async j=>j)}));
jest.mock('../lib/server/active-journeys.mjs',()=>({directJourneys:jest.fn(async()=>[]),cyclingConnections:jest.fn(async()=>[]),cyclingAccess:jest.fn(async()=>[])}));
jest.mock('../lib/server/weather.mjs',()=>({weatherForecast:jest.fn(async()=>({})),journeyWeather:jest.fn((w,o,d)=>({wet:d.rain,advice:d.rain?'Bring an umbrella':null}))}));
jest.mock('../lib/server/lta.mjs',()=>{
  const real=jest.requireActual('../lib/server/lta.mjs');
  return {normalizeAlerts:real.normalizeAlerts,enrichJourneys:jest.fn(async(js,now,options)=>{
    const alerts=options?.alerts || {status:1,segments:[],messages:[]};
    js.forEach(j=>j.legs.forEach(l=>{l.alerts=real.affectedLeg(l,alerts);}));return alerts;
  })};
});
import { journeyCandidates } from '../lib/server/onemap.mjs';
import { cyclingAccess } from '../lib/server/active-journeys.mjs';
import { planJourney,validatePlan } from '../lib/server/planner.mjs';
import { DEMO_HOME,DEMO_WORK } from '../lib/demo.mjs';
const path=[[103.91,1.4],[103.90,1.4]];
function trip(mode,service,line,start,duration,level='l') {
  return {id:service,startTime:start,endTime:start+duration*1000,durationSeconds:duration,transfers:0,legs:[{id:service,mode,service,line,lineName:service,from:{code:line==='PTL'?'PE4':'NE17'},to:{code:line==='PTL'?'PTC':'NE12'},stops:[],geometry:path,distanceMeters:1000,alerts:[],crowd:{level},startTime:start,endTime:start+duration*1000}]};
}
const input=extra=>validatePlan({origin:DEMO_HOME,destination:DEMO_WORK,preferences:{walking:1,cycling:1,shelter:0,crowd:1,flexibility:0,bike:'folding'},...extra});
test('rain excludes bicycle generation; Status 2 removes LRT from recommendations but retains original comparison',async()=>{
  journeyCandidates.mockImplementation(async(o,d,at)=>[trip('rail','PE','PTL',at.getTime(),600),trip('bus','381',null,at.getTime(),900)]);
  const result=await planJourney(input({demo:{rain:true,disruption:true}}));
  expect(cyclingAccess.mock.calls[0][3].cycling).toBe(0);
  expect(result.journeys[0].legs[0].mode).toBe('bus');expect(result.journeys[0].affected).toBe(false);
  expect(result.comparisonJourney.affected).toBe(true);expect(result.alerts.source).toBe('demo');expect(result.weather.wet).toBe(true);
});
test('forecast crowd tradeoff can recommend a real later departure',async()=>{
  const plan=input({preferences:{walking:1,cycling:0,shelter:0,crowd:1,flexibility:1,bike:'none'}}),start=plan.departure.getTime();
  journeyCandidates.mockImplementation(async(o,d,at)=>[trip('rail','NE','NEL',at.getTime(),900,at.getTime()===start?'h':'l')]);
  const result=await planJourney(plan);
  expect(result.journeys[0].departureOffsetMinutes).toBe(20);expect(result.journeys[0].startTime).toBe(start+20*60000);
});
test('waiting before the first connection is included in the recommendation cost',async()=>{
  journeyCandidates.mockImplementation(async(o,d,at)=>[trip('bus','50',null,at.getTime()+20*60000,600),trip('rail','NE','NEL',at.getTime(),1200)]);
  const result=await planJourney(input());expect(result.journeys[0].legs[0].service).toBe('NE');
  const bus=result.journeys.find(j=>j.legs[0].service==='50');expect(bus.initialWaitSeconds).toBe(1200);expect(bus.durationSeconds).toBe(1800);
});
