import { point, preferences, scoreJourney } from '../routing.mjs';
import { journeyCandidates } from './onemap.mjs';
import { refineWalking } from './valhalla.mjs';
import { enrichJourneys, normalizeAlerts } from './lta.mjs';
import { directJourneys, cyclingConnections, cyclingAccess } from './active-journeys.mjs';
import { weatherForecast, journeyWeather } from './weather.mjs';
import { demoOptions, demoDisruption, PUNGGOL_MRT } from '../demo.mjs';

export function validatePlan(body,now=Date.now()) {
  const origin=point(body.origin),destination=point(body.destination),prefs=preferences(body.preferences);
  const departure=body.departure?new Date(body.departure):new Date(now),arriveBy=body.arriveBy?new Date(body.arriveBy):null;
  if(!Number.isFinite(departure.getTime()) || departure.getTime()<now-60000 || departure.getTime()>now+30*86400000) throw new Error('Departure must be now or within the next 30 days.');
  if(arriveBy && (!Number.isFinite(arriveBy.getTime()) || arriveBy.getTime()<=now || arriveBy.getTime()>now+30*86400000)) throw new Error('Calendar event must be within the next 30 days.');
  return {origin,destination,prefs,departure,arriveBy,demo:demoOptions(body.demo)};
}
export async function planJourney(input) {
  const {origin,destination,prefs,arriveBy,demo}=input;
  let departure=input.departure;
  const weather=journeyWeather(await weatherForecast(),origin,demo);
  const effectivePrefs={...prefs,...(weather.wet?{cycling:0,shelter:Math.max(.75,prefs.shelter)}:{})};
  let transitFailure=false;
  const collect=async(at)=>{
    const [transit,active]=await Promise.allSettled([journeyCandidates(origin,destination,at,effectivePrefs),directJourneys(origin,destination,at,effectivePrefs)]);
    transitFailure ||= transit.status==='rejected';
    return [...(transit.status==='fulfilled'?transit.value:[]),...(active.status==='fulfilled'?active.value:[])];
  };
  if(arriveBy) departure=new Date(Math.max(Date.now(),arriveBy.getTime()-3600000));
  let initial=await collect(departure);
  if(arriveBy && initial.length) {
    const duration=Math.min(...initial.map(j=>j.durationSeconds));
    const candidate=new Date(Math.max(Date.now(),arriveBy.getTime()-duration*1000-600000));
    if(Math.abs(candidate-departure)>60000) {departure=candidate;initial=await collect(departure);}
  }
  const offsets=(prefs.flexibility ?? 0)>=1?[20,40,60]:(prefs.flexibility ?? 0)>=.5?[20]:[];
  const later=await Promise.all(offsets.filter(m=>!arriveBy || departure.getTime()+m*60000<arriveBy.getTime()).map(async m=>{
    const at=new Date(departure.getTime()+m*60000),candidates=await collect(at);
    return candidates.map(j=>({...j,id:`later-${m}-${j.id}`,departureOffsetMinutes:m,requestedStart:at.getTime()}));
  }));
  const raw=[...initial,...later.flat()];
  const journeys=(await Promise.all(raw.map(async j=>{
    if(j.legs[0]?.mode==='walk') j.legs[0].from.name=origin.label;
    if(j.legs.at(-1)?.mode==='walk') j.legs.at(-1).to.name=destination.label;
    return j.legs.every(l=>['walk','cycle'].includes(l.mode))?j:refineWalking(j,effectivePrefs,j.requestedStart || departure.getTime());
  }))).filter(Boolean);
  const first=journeys.filter(j=>!j.departureOffsetMinutes);
  const [tails,access]=await Promise.all([cyclingConnections(first,destination,effectivePrefs),cyclingAccess(origin,destination,first,effectivePrefs,departure,demo.disruption?[PUNGGOL_MRT]:[])]);
  journeys.push(...tails,...access);
  if(!journeys.length) {const e=new Error('No feasible mapped journey found. Try a nearby entrance or another departure time.');e.status=404;throw e;}
  const demoAlerts=demo.disruption?{...normalizeAlerts(demoDisruption()),observedAt:new Date().toISOString(),source:'demo'}:null;
  const alerts=await enrichJourneys(journeys,Date.now(),{alerts:demoAlerts});
  for(const j of journeys) {
    if(j.legs.at(-1).to)j.legs.at(-1).to.name=destination.label;
    j.departureOffsetMinutes ||= 0;
    j.travelDurationSeconds=j.durationSeconds;
    j.initialWaitSeconds=Math.max(0,(j.startTime-departure.getTime()-j.departureOffsetMinutes*60000)/1000);
    j.durationSeconds+=j.initialWaitSeconds;
    j.bikePolicy=j.legs.some(l=>l.mode==='cycle') && j.legs.some(l=>l.mode==='rail'||l.mode==='bus') ? prefs.bike==='park'?'Park before boarding; collect your bike on the return trip.':'Bring a folded bike within 120 × 70 × 40 cm; keep it folded in stations and on board.':null;
  }
  const scored=journeys.map(j=>scoreJourney(j,effectivePrefs));
  const original=(demo.disruption?scored.filter(j=>j.legs.some(l=>l.line==='PTL')&&!j.departureOffsetMinutes):scored.filter(j=>!j.departureOffsetMinutes)).sort((a,b)=>a.durationSeconds-b.durationSeconds)[0] || scored[0];
  const cost=j=>j.score+(arriveBy && j.endTime>arriveBy.getTime()?2000:0);
  const ranked=scored.sort((a,b)=>cost(a)-cost(b)).slice(0,6);
  for(const j of ranked) {j.timeDifferenceMinutes=Math.round((j.durationSeconds-original.durationSeconds)/60);j.arrivalDifferenceMinutes=Math.round((j.endTime-original.endTime)/60000);}
  const warnings=[];
  if(transitFailure)warnings.push('Some transit searches were unavailable.');
  if(ranked.some(j=>j.walkingFallback))warnings.push('Some walking links retain transit-planner estimates.');
  if(ranked.some(j=>j.shelteredMeters===null))warnings.push('Shelter coverage is unavailable for some paths.');
  if(alerts.status===null)warnings.push('Disruption feed unavailable.');
  if(ranked.every(j=>j.affected))warnings.push('No unaffected route found. Follow operator guidance.');
  const notice=weather.advice || (ranked[0].departureOffsetMinutes?`Leave ${ranked[0].departureOffsetMinutes} minutes later for a better comfort match.`:ranked[0].id!==original.id && original.affected?'Avoid the disrupted connection with the recommended route.':ranked[0].crowdComparison==='more'?'Crowds are above the historical demand estimate. Consider another departure.':null);
  return {origin,destination,preferences:prefs,journeys:ranked,comparisonJourney:original,alerts,warnings,weather,demo,notice,
    generatedAt:new Date().toISOString(),requestedDeparture:departure.toISOString(),arriveBy:arriveBy?.toISOString() || null,
    calendar:arriveBy?{onTime:ranked[0].endTime<=arriveBy.getTime(),leaveAt:new Date(ranked[0].startTime).toISOString(),bufferMinutes:Math.floor((arriveBy.getTime()-ranked[0].endTime)/60000)}:null};
}
