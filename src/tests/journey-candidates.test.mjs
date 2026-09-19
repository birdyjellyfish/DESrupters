jest.mock('../lib/server/cache.mjs',()=>({cached:jest.fn((key,ttl,fn)=>fn())}));
import { journeyCandidates, searchPlaces, activePath } from '../lib/server/onemap.mjs';
test('asks for bus/rail/transit using private Authorization header, deduplicates routes',async()=>{
  process.env.ONEMAP_KEY='test-only';
  global.fetch=jest.fn(async url=>({ok:true,json:async()=>({plan:{itineraries:[{duration:1000,endTime:2000,legs:[{mode:url.includes('mode=bus')?'BUS':'SUBWAY',routeShortName:url.includes('mode=bus')?'43':'NE',from:{stopCode:'NE17'},to:{stopCode:'NE12'}}]}]}})}));
  const result=await journeyCandidates({lat:1.3,lon:103.8},{lat:1.31,lon:103.81},new Date('2026-09-19T01:00:00Z'),{walking:.5});
  expect(result).toHaveLength(2);expect(fetch).toHaveBeenCalledTimes(3);
  for(const [url,options] of fetch.mock.calls){expect(url).not.toContain('test-only');expect(options.headers.Authorization).toBe('test-only');expect(url).toContain('date=09-19-2026');}
});

test('finds campus names despite OneMap and/ampersand literal search differences',async()=>{
  process.env.ONEMAP_KEY='test-only';
  global.fetch=jest.fn().mockResolvedValueOnce({ok:true,json:async()=>({results:[]})}).mockResolvedValueOnce({ok:true,json:async()=>({results:[{SEARCHVAL:'UNIVERSITY TOWN (COLLEGE OF ALICE & PETER TAN)',LATITUDE:'1.30758',LONGITUDE:'103.77315'}]})});
  expect(await searchPlaces('College of Alice and Peter Tan')).toHaveLength(1);
  expect(new URL(fetch.mock.calls[1][0]).searchParams.get('searchVal')).toBe('College Alice Peter Tan');
});

test('OneMap walking distances remain metres rather than kilometres',async()=>{
  global.fetch=jest.fn(async()=>({ok:true,json:async()=>({route_summary:{total_distance:467,total_time:350},route_geometry:'_p~iF~ps|U_ulLnnqC',route_instructions:[['Left','Campus path',467,'',350,'','','','','Follow campus path']]})}));
  const result=await activePath({lat:1.3,lon:103.8},{lat:1.31,lon:103.81},'walk');
  expect(result.distanceMeters).toBe(467);expect(result.instructions[0].meters).toBe(467);
});
