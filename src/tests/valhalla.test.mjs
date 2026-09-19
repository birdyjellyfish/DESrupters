jest.mock('../lib/server/cache.mjs',()=>({cached:jest.fn((key,ttl,fn)=>fn())}));
jest.mock('../lib/server/spatial.mjs',()=>({walkingContext:jest.fn(async()=>({available:true,shelteredMeters:20})),stationExit:jest.fn(async()=>null)}));
jest.mock('../lib/server/onemap.mjs',()=>({activePath:jest.fn()}));
import { refineWalking, activeAlternatives } from '../lib/server/valhalla.mjs';
import { activePath } from '../lib/server/onemap.mjs';
const base={mode:'walk',from:{lat:1.3,lon:103.8,name:'Origin'},to:{lat:1.31,lon:103.81,name:'Station',code:'NE17'},geometry:[[103.8,1.3],[103.81,1.31]],durationSeconds:60,distanceMeters:80,instructions:[{text:'Existing path'}],startTime:0,endTime:60000};
test('never replaces a walk with a path that misses its scheduled train',async()=>{
  global.fetch=jest.fn(async()=>({ok:true,json:async()=>({trip:{summary:{length:.5,time:600},legs:[{shape:'_p~iF~ps|U_ulLnnqC',maneuvers:[{instruction:'Too long',time:600,length:.5}]}]}})}));
  const j={legs:[{...base},{mode:'rail',startTime:120000,endTime:600000}]};
  const result=await refineWalking(j,{walking:.5,shelter:.5},0);
  expect(result).toBeNull();expect(j.legs[1].startTime).toBe(120000);
});

test('uses routed kilometres as metres and preserves a feasible boarding time',async()=>{
  global.fetch=jest.fn(async()=>({ok:true,json:async()=>({trip:{summary:{length:.432,time:324},legs:[{shape:'_p~iF~ps|U_ulLnnqC',maneuvers:[{instruction:'Follow footpath',length:.432}]}]}})}));
  const j={legs:[{...base},{mode:'rail',startTime:600000,endTime:900000}]};
  await refineWalking(j,{walking:.5,shelter:.5},0);
  expect(j.legs[0].distanceMeters).toBe(432);expect(j.legs[0].durationSeconds).toBe(324);expect(j.legs[0].endTime).toBe(540000);expect(j.legs[1].startTime).toBe(600000);
});

test('requests a bicycle graph and falls back to OneMap cycle routing',async()=>{
  global.fetch=jest.fn(async()=>({ok:false}));
  activePath.mockResolvedValueOnce({distanceMeters:800,durationSeconds:240,geometry:[[103.8,1.3],[103.81,1.31]]});
  const [path]=await activeAlternatives(base.from,base.to,'cycle');
  expect(JSON.parse(fetch.mock.calls[0][1].body).costing).toBe('bicycle');
  expect(activePath).toHaveBeenCalledWith(base.from,base.to,'cycle');expect(path.distanceMeters).toBe(800);
});
test('preserves transit-planner concourse links rather than snapping them to a street',async()=>{
  global.fetch=jest.fn();const j={legs:[{...base,from:{...base.from,code:'NE17'},to:{...base.to,code:'PTC'}}]};
  await refineWalking(j,{walking:.5,shelter:.5},0);expect(fetch).not.toHaveBeenCalled();
});
