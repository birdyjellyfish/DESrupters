jest.mock('../lib/server/cache.mjs',()=>({cached:jest.fn((key,ttl,fn)=>fn())}));
import { normalizeAlerts, affectedLeg, stationCrowd, forecastCrowd, busArrivals, enrichJourneys, CROWD_TTL, FORECAST_TTL } from '../lib/server/lta.mjs';
const now=Date.parse('2026-09-19T01:00:00Z');
const rail={mode:'rail',line:'NEL',lineName:'North East Line',from:{code:'NE17'},to:{code:'NE12'},stops:[{code:'NE16'}]};
test('Status 2 matches affected route segment, not an unrelated line',()=>{
  const alert=normalizeAlerts({value:{Status:2,AffectedSegments:[{Line:'NEL',Stations:'NE16,NE17'}],Message:[{Content:'Signal fault between Sengkang and Punggol.'}]}});
  expect(affectedLeg(rail,alert)[0]).toMatch(/Signal fault/);
  expect(affectedLeg({...rail,line:'EWL'},alert)).toEqual([]);
  expect(normalizeAlerts({value:{Status:1,AffectedSegments:[]}}).status).toBe(1);
  expect(normalizeAlerts(null).status).toBeNull();
});
test('uses exact station and rejects expired or missing crowd observations',()=>{
  const record={data:{value:[{Station:'NE17',CrowdLevel:'h',StartTime:'2026-09-19T08:55:00+08:00',EndTime:'2026-09-19T09:05:00+08:00'}]}};
  expect(stationCrowd(record,'NE17',now).level).toBe('h');
  expect(stationCrowd(record,'NE12',now).level).toBeNull();
  expect(stationCrowd(record,'NE17',now+600000).level).toBe('h');
  expect(stationCrowd(record,'NE17',now+900000).level).toBeNull();
  expect(CROWD_TTL).toBe(600);expect(FORECAST_TTL).toBe(86400);
});
test('bus timing and occupancy use exact service, with no fabricated defaults',()=>{
  const record={data:{Services:[{ServiceNo:'43',NextBus:{EstimatedArrival:'2026-09-19T09:03:00+08:00',Load:'LSD',Type:'DD'},NextBus2:{EstimatedArrival:''}}]}};
  expect(busArrivals(record,'43',now)[0]).toMatchObject({minutes:3,occupancy:'Limited standing',type:'Double deck',level:'h'});
  expect(busArrivals(record,'10',now)).toEqual([]);
});
test('integration enrichment mocks all external feeds and deduplicates stops/lines',async()=>{
  process.env.LTA_ACCOUNT_KEY='test-only';
  global.fetch=jest.fn(async url=>({ok:true,json:async()=>url.includes('TrainServiceAlerts')?{value:{Status:1,AffectedSegments:[]}}:url.includes('BusArrival')?{Services:[]}:{value:[]}}));
  const j={legs:[{...rail,startTime:now},{...rail,startTime:now},{mode:'bus',service:'43',from:{code:'65059'},to:{code:'65069'},stops:[],startTime:now}]};
  await enrichJourneys([j],now);
  expect(fetch).toHaveBeenCalledTimes(4);expect(j.legs[0].crowd.level).toBeNull();expect(j.legs[2].arrivals).toEqual([]);
});
test('forecast uses the correct half-hour interval, including its exclusive end',()=>{
  const record={data:{value:[{Stations:[{Station:'NE17',Interval:[{Start:'2026-09-19T09:00:00+08:00',CrowdLevel:'h'},{Start:'2026-09-19T09:30:00+08:00',CrowdLevel:'l'}]}]}]}};
  expect(forecastCrowd(record,'NE17',now+20*60000).level).toBe('h');
  expect(forecastCrowd(record,'NE17',now+30*60000).level).toBe('l');
  expect(forecastCrowd(record,'NE17',now+60*60000).level).toBeNull();
});
test('LRT requests use PLRT and later departures use forecast rather than present crowd',async()=>{
  global.fetch=jest.fn(async url=>({ok:true,json:async()=>url.includes('TrainServiceAlerts')?{value:{Status:1,AffectedSegments:[]}}:url.includes('PCDForecast')?{value:[{Stations:[{Station:'PE4',Interval:[{Start:'2026-09-19T09:30:00+08:00',CrowdLevel:'h'}]}]}]}:{value:[{Station:'PE4',StartTime:'2026-09-19T09:00:00+08:00',EndTime:'2026-09-19T09:10:00+08:00',CrowdLevel:'l'}]}}));
  const j={legs:[{...rail,line:'PTL',from:{code:'PE4'},to:{code:'PTC'},startTime:now+35*60000,endTime:now+40*60000}]};
  await enrichJourneys([j],now);expect(j.legs[0].crowd).toMatchObject({level:'h',source:'forecast'});expect(j.legs[0].currentCrowd.level).toBe('l');
  expect(fetch.mock.calls.some(([url])=>url.includes('TrainLine=PLRT'))).toBe(true);expect(fetch.mock.calls.some(([url])=>url.includes('TrainLine=PTL'))).toBe(false);
});
