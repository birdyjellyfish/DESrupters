jest.mock('../lib/server/valhalla.mjs',()=>({activeAlternatives:jest.fn()}));
jest.mock('../lib/server/spatial.mjs',()=>({walkingContext:jest.fn(async()=>({available:true,shelteredMeters:100}))}));
import { activeAlternatives } from '../lib/server/valhalla.mjs';
import { directJourneys, cyclingConnections } from '../lib/server/active-journeys.mjs';
import { scoreJourney } from '../lib/routing.mjs';
const origin={label:'College of Alice and Peter Tan',lat:1.307,lon:103.773},destination={label:'Utown Auditorium 1',lat:1.305,lon:103.774};
const prefs={walking:.8,cycling:.8,shelter:0,crowd:0};
const path={distanceMeters:380,durationSeconds:285,geometry:[[103.773,1.307],[103.774,1.305]],instructions:[{text:'Follow the campus path',meters:380}]};
test('short journeys have standalone walking and cycling with genuine path distances',async()=>{
  activeAlternatives.mockResolvedValue([path]);
  const result=await directJourneys(origin,destination,new Date(0),prefs);
  expect(result.map(j=>j.legs[0].mode)).toEqual(['walk','cycle']);expect(result[0].legs[0].distanceMeters).toBe(380);
  expect(result[1].durationSeconds).toBe(405);expect(result[1].legs[0].setupSeconds).toBe(120);
});
test('cycling off makes no bicycle requests and routing failure never fabricates a path',async()=>{
  activeAlternatives.mockRejectedValue(new Error('No mapped path'));
  expect(await directJourneys(origin,destination,new Date(0),{...prefs,cycling:0})).toEqual([]);
  expect(activeAlternatives).toHaveBeenCalledTimes(1);expect(activeAlternatives.mock.calls[0][2]).toBe('walk');
});
test('can replace a final bus wait with cycling without shifting the retained transit',async()=>{
  activeAlternatives.mockResolvedValue([{...path,distanceMeters:1500,durationSeconds:360}]);
  const rail={mode:'rail',from:origin,to:{name:'Station',lat:1.31,lon:103.76},startTime:0,endTime:600000,geometry:path.geometry,alerts:[],crowd:{level:'l'}};
  const bus={mode:'bus',from:rail.to,to:destination,startTime:1500000,endTime:1800000};
  const result=await cyclingConnections([{legs:[rail,bus]}],destination,prefs);
  expect(result[0].legs.map(l=>l.mode)).toEqual(['rail','cycle']);expect(result[0].legs[0].endTime).toBe(600000);
  expect(result[0].endTime).toBe(1080000);expect(result[0].transfers).toBe(0);
});
test('cycling slider changes the preferred mode when there is a real tradeoff',()=>{
  const cycle={durationSeconds:900,transfers:0,legs:[{mode:'cycle',distanceMeters:3000,geometry:path.geometry,alerts:[]}]};
  const bus={durationSeconds:1200,transfers:0,legs:[{mode:'bus',distanceMeters:4000,crowd:{level:'l'},geometry:path.geometry,alerts:[]}]};
  expect(scoreJourney(cycle,{...prefs,cycling:1}).score).toBeLessThan(scoreJourney(bus,prefs).score);
  expect(scoreJourney(cycle,{...prefs,cycling:.1}).score).toBeGreaterThan(scoreJourney(bus,prefs).score);
});
