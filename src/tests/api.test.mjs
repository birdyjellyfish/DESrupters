jest.mock('../lib/server/onemap.mjs',()=>({journeyCandidates:jest.fn()}));
jest.mock('../lib/server/valhalla.mjs',()=>({refineWalking:jest.fn(async j=>j)}));
jest.mock('../lib/server/active-journeys.mjs',()=>({directJourneys:jest.fn(async()=>[]),cyclingConnections:jest.fn(async()=>[]),cyclingAccess:jest.fn(async()=>[])}));
jest.mock('../lib/server/weather.mjs',()=>({weatherForecast:jest.fn(async()=>({})),journeyWeather:jest.fn(()=>({wet:false}))}));
jest.mock('../lib/server/lta.mjs',()=>({enrichJourneys:jest.fn(async()=>({status:1,segments:[],messages:[]}))}));
import { POST } from '../app/api/route/route.js';
import { journeyCandidates } from '../lib/server/onemap.mjs';
import { directJourneys } from '../lib/server/active-journeys.mjs';
const request=body=>new Request('http://localhost/api/route',{method:'POST',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}});
beforeEach(()=>journeyCandidates.mockResolvedValue([]));
test('invalid route inputs return 400 without upstream requests',async()=>{
  const response=await POST(request({origin:{lat:99,lon:0}}));expect(response.status).toBe(400);expect(journeyCandidates).not.toHaveBeenCalled();
});

test('returns a walking journey even when transit cannot find the campus trip',async()=>{
  journeyCandidates.mockRejectedValueOnce(new Error('No transit service'));
  const start=Date.now();
  directJourneys.mockResolvedValueOnce([{id:'direct-walk-0',startTime:start,endTime:start+300000,durationSeconds:300,transfers:0,legs:[{id:'w',mode:'walk',from:{name:'College of Alice and Peter Tan'},to:{name:'Utown Auditorium 1'},geometry:[[103.773,1.307],[103.774,1.305]],alerts:[],distanceMeters:380,spatial:{available:true,shelteredMeters:100}}]}]);
  const response=await POST(request({origin:{lat:1.307,lon:103.773,label:'College of Alice and Peter Tan'},destination:{lat:1.305,lon:103.774,label:'Utown Auditorium 1'}}));
  const data=await response.json();expect(response.status).toBe(200);expect(data.journeys[0].walkingMeters).toBe(380);expect(data.journeys[0].legs[0].mode).toBe('walk');
});
test('calendar probes near the event and makes a scheduled arrival recommendation',async()=>{
  const event=Date.now()+12*3600000;
  journeyCandidates.mockImplementation(async(o,d,departure)=>[{id:'j',startTime:departure.getTime(),endTime:departure.getTime()+1800000,durationSeconds:1800,transfers:0,legs:[{id:'l',mode:'rail',distanceMeters:1000,geometry:[[103.8,1.3],[103.81,1.31]],crowd:{level:'l'},alerts:[],startTime:departure.getTime(),endTime:departure.getTime()+1800000}]}]);
  const response=await POST(request({origin:{lat:1.3,lon:103.8},destination:{lat:1.31,lon:103.81},arriveBy:new Date(event).toISOString()}));
  const data=await response.json();expect(response.status).toBe(200);expect(data.calendar.onTime).toBe(true);expect(data.calendar.bufferMinutes).toBe(10);
  expect(journeyCandidates.mock.calls[0][2].getTime()).toBeGreaterThan(Date.now()+10*3600000);
});
