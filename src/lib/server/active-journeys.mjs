import { activeAlternatives } from './valhalla.mjs';
import { walkingContext } from './spatial.mjs';
import { transitJourneys } from './onemap.mjs';
import { refineWalking } from './valhalla.mjs';

// Used only to bound requests; displayed distances always come from a routed path.
function separation(a, b) {
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(Math.sin((b.lat-a.lat)*Math.PI/360)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin((b.lon-a.lon)*Math.PI/360)**2)));
}
const limit = (mode, prefs) => mode === 'walk' ? 1000 + prefs.walking * 5000 : 1000 + (prefs.cycling ?? 0) * 19000;
async function legsBetween(from, to, mode, startTime, prefs) {
  if (separation(from,to) > limit(mode,prefs)) return [];
  try {
    const paths = await activeAlternatives(from,to,mode);
    return await Promise.all(paths.filter(p => p.distanceMeters <= limit(mode,prefs)).slice(0,2).map(async p => ({
      ...p, id: mode, mode, from: { ...from, name: from.name || from.label, code: from.code || '' }, to: { ...to, name: to.name || to.label, code: to.code || '' },
      startTime, endTime: startTime + (p.durationSeconds + (mode === 'cycle' ? 120 : 0))*1000,
      durationSeconds: p.durationSeconds + (mode === 'cycle' ? 120 : 0),
      bikeRequired: mode === 'cycle', setupSeconds: mode === 'cycle' ? 120 : 0,
      spatial: mode === 'walk' ? await walkingContext(p.geometry) : undefined,
      service: '', line: null, stops: [], alerts: [], crowd: { label: 'Unavailable', level: null }, timingSource: 'estimated',
    })));
  } catch { return []; }
}
function itinerary(legs, id) {
  const transitCount = legs.filter(l => ['bus','rail'].includes(l.mode)).length;
  return { id, legs: legs.map((l,i) => ({...l,id:`${id}-${i}`})), startTime: legs[0].startTime, endTime: legs.at(-1).endTime,
    durationSeconds: (legs.at(-1).endTime-legs[0].startTime)/1000, transfers: Math.max(0,transitCount-1), fare: null };
}
export async function directJourneys(origin, destination, departure, prefs) {
  const modes = (prefs.cycling ?? 0) > 0 ? ['walk','cycle'] : ['walk'];
  const legs = (await Promise.all(modes.map(mode => legsBetween(origin,destination,mode,departure.getTime(),prefs)))).flat();
  const distinct = legs.filter((leg,i) => !legs.slice(0,i).some(other => other.mode === leg.mode && Math.abs(other.distanceMeters-leg.distanceMeters)<50 && Math.abs(other.durationSeconds-leg.durationSeconds)<60 && Math.abs((other.spatial?.shelteredMeters || 0)-(leg.spatial?.shelteredMeters || 0))<50));
  return distinct.map((leg,i) => itinerary([leg],`direct-${leg.mode}-${i}`));
}
export async function cyclingConnections(journeys, destination, prefs) {
  if (!(prefs.cycling > 0) || prefs.bike==='park') return [];
  const connections = new Map();
  for (const journey of journeys) {
    journey.legs.forEach((leg,i) => {
      if (!['bus','rail'].includes(leg.mode) || i === journey.legs.length-1) return;
      const distance = separation(leg.to,destination);
      if (distance < 200 || distance > limit('cycle',prefs)) return;
      const key = `${leg.to.lat},${leg.to.lon}`;
      const existing = connections.get(key);
      if (!existing || leg.endTime < existing.startTime) connections.set(key,{from:leg.to,startTime:leg.endTime,legs:journey.legs.slice(0,i+1),distance});
    });
  }
  // Bound router work while including alighting before the final feeder bus.
  const candidates = [...connections.values()].sort((a,b) => a.distance-b.distance).slice(0,3);
  return (await Promise.all(candidates.map(async (c,i) => {
    const tails = await legsBetween(c.from,destination,'cycle',c.startTime,prefs);
    return tails.slice(0,1).map(tail => itinerary([...c.legs,tail],`connection-cycle-${i}`));
  }))).flat();
}
export async function cyclingAccess(origin,destination,journeys,prefs,departure,extraStations=[]) {
  if(!(prefs.cycling>0)) return [];
  const unique=new Map();
  for(const station of [...extraStations,...journeys.flatMap(j=>j.legs.filter(l=>l.mode==='rail').map(l=>l.from))]) {
    if(separation(origin,station)>4500 || separation(origin,station)<200) continue;
    unique.set(station.code,station);
  }
  // Prefer an MRT entry that can bypass the LRT; also retain a nearby LRT option.
  const stations=[...unique.values()].sort((a,b)=>Number(/^(PE|PW|PTC)/.test(a.code))-Number(/^(PE|PW|PTC)/.test(b.code)) || separation(origin,a)-separation(origin,b)).slice(0,2);
  return (await Promise.all(stations.map(async(station,index)=>{
    const access=(await legsBetween(origin,station,'cycle',departure.getTime(),prefs))[0];
    if(!access) return [];
    access.bikeAction=prefs.bike==='park'?'Park your bike before entering the station':'Fold your bike before entering the station';
    access.endTime+=120000;access.durationSeconds+=120;
    access.bikeRequired=true;
    let tails=[];
    try {tails=await transitJourneys(station,destination,new Date(access.endTime),prefs,'rail');}catch{return [];}
    const refined=(await Promise.all(tails.map(j=>refineWalking(j,prefs,access.endTime)))).filter(Boolean);
    return refined.map((tail,i)=>itinerary([{...access},...tail.legs],`access-cycle-${index}-${i}`));
  }))).flat();
}
