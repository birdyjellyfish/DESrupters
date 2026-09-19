import { point, preferences, decodePolyline, lineCode, normalizeItinerary, scoreJourney, singaporeDateTime, journeyGeojson } from '../lib/routing.mjs';
test('validates Singapore points and bounded preference dimensions', () => {
  expect(point({lat:1.3,lon:103.8}).lat).toBe(1.3);
  for (const value of [null,{}, {lat:null,lon:103.8},{lat:51,lon:0}]) expect(()=>point(value)).toThrow();
  expect(()=>preferences({crowd:2})).toThrow();
});
test('decodes geometry with explicit precision and rejects malformed data',()=>{
  expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([[-120.2,38.5],[-120.95,40.7],[-126.453,43.252]]);
  expect(()=>decodePolyline('~~~~~~~')).toThrow();
});
test('canonical rail codes and Singapore calendar day',()=>{
  expect(lineCode('NE17')).toBe('NEL'); expect(lineCode('SE3')).toBe('STL'); expect(lineCode('PTL')).toBe('PTL');
  expect(singaporeDateTime(new Date('2026-09-18T18:00:00Z'))).toEqual({date:'09-19-2026',time:'02:00:00'});
});
const leg = (mode,extra={})=>({mode,from:{code:'NE17'},to:{code:'NE12'},stops:[],geometry:[[103.8,1.3],[103.81,1.31]],alerts:[],distanceMeters:600,durationSeconds:500,...extra});
const journey = (shelter,crowd,duration=1800)=>({legs:[leg('walk',{spatial:{available:true,shelteredMeters:shelter}}),leg('rail',{crowd:{level:crowd}})],transfers:0,durationSeconds:duration});
test('shelter and crowd dimensions change ranking; unavailable crowd is not treated as low',()=>{
  const prefs={walking:1,shelter:1,crowd:1};
  expect(scoreJourney(journey(550,'l'),prefs).score).toBeLessThan(scoreJourney(journey(20,'h'),prefs).score);
  expect(scoreJourney(journey(550,null),prefs).score).toBeGreaterThan(scoreJourney(journey(550,'l'),prefs).score);
  const lessWalk={walking:0,shelter:0,crowd:0},active={...lessWalk,walking:1};
  expect(scoreJourney(journey(0,'l'),lessWalk).score).toBeGreaterThan(scoreJourney(journey(0,'l'),active).score);
});
test('walk/bus/rail itinerary retains all instructions and service numbers',()=>{
  const j=normalizeItinerary({duration:1800,legs:[{mode:'WALK',steps:Array.from({length:15},()=>({relativeDirection:'LEFT',streetName:'Test Road',distance:10}))},{mode:'BUS',routeShortName:'43',from:{stopId:'BUS:65059'}},{mode:'SUBWAY',routeShortName:'NE',from:{stopCode:'NE17'}}]},0);
  expect(j.legs.map(l=>l.mode)).toEqual(['walk','bus','rail']);expect(j.legs[0].instructions).toHaveLength(15);expect(j.legs[1].from.code).toBe('65059');expect(j.legs[2].line).toBe('NEL');
});

test('map highlights only the disrupted station span within a longer rail leg',()=>{
  const stops=Array.from({length:4},(_,i)=>({code:`NE${i+1}`,lon:103.8+i*.01,lat:1.3}));
  const route=journeyGeojson({legs:[leg('rail',{from:stops[0],to:stops[3],stops:stops.slice(1,3),geometry:stops.map(s=>[s.lon,s.lat]),alerts:['Disrupted'],disruptionStations:['NE2','NE3']})]});
  expect(route.features.map(f=>f.properties.affected)).toEqual([false,true,false]);
  expect(route.features[1].geometry.coordinates).toEqual(stops.slice(1,3).map(s=>[s.lon,s.lat]));
});

test('folding-bike preference accounts for the effort of another bus boarding',()=>{
  const route={legs:[leg('bus',{crowd:{level:'l'}})],transfers:0,durationSeconds:600};
  const prefs={walking:1,cycling:1,shelter:0,crowd:1};
  expect(scoreJourney(route,{...prefs,bike:'folding'}).score-scoreJourney(route,{...prefs,bike:'none'}).score).toBe(8);
});
