import { decodePolyline } from '../routing.mjs';
import { cached } from './cache.mjs';
import { walkingContext, stationExit } from './spatial.mjs';
import { activePath } from './onemap.mjs';
export async function activeAlternatives(from, to, mode = 'walk') {
  const costing = mode === 'cycle' ? 'bicycle' : 'pedestrian';
  try { return await cached(`active-v2:${mode}:${from.lat},${from.lon}:${to.lat},${to.lon}`, 3600, async () => {
    const response = await fetch(`${(process.env.VALHALLA_URL || 'http://localhost:8002').replace(/\/$/,'')}/route`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ locations: [{ lat: from.lat, lon: from.lon }, { lat: to.lat, lon: to.lon }], costing, alternates: 2,
        costing_options: { pedestrian: { walking_speed: 4.8, use_ferry: 0 }, bicycle: { bicycle_type: 'Hybrid', cycling_speed: 16, use_roads: 0.2, use_ferry: 0 } }, units: 'kilometers', shape_format: 'polyline6', directions_options: { language: 'en-US', units: 'kilometers' } }),
    });
    if (!response.ok) throw new Error('Walking router unavailable');
    const data = await response.json();
    const paths = [data.trip, ...(data.alternates || []).map(a => a.trip)].filter(t => t?.legs?.length).map(t => ({
      geometry: t.legs.flatMap(l => decodePolyline(l.shape, 6)), distanceMeters: Number(t.summary.length) * 1000, durationSeconds: Number(t.summary.time),
      instructions: t.legs.flatMap(l => (l.maneuvers || []).map(m => ({ text: m.instruction || m.verbal_pre_transition_instruction, meters: Math.round(Number(m.length || 0) * 1000) }))), geometrySource: 'Valhalla / OpenStreetMap',
    })).filter(p => Number.isFinite(p.distanceMeters) && p.distanceMeters > 0 && Number.isFinite(p.durationSeconds) && p.durationSeconds > 0 && p.geometry.length >= 2);
    if (!paths.length) throw new Error('No mapped path');
    return paths;
  }); } catch { return [await activePath(from, to, mode)]; }
}
export async function refineWalking(journey, prefs, requestedDeparture) {
  for (let i = 0; i < journey.legs.length; i++) {
    const leg = journey.legs[i];
    if (leg.mode !== 'walk') continue;
    const previous = journey.legs[i-1], next = journey.legs[i+1];
    const earliest = previous?.endTime || requestedDeparture;
    const latest = next?.startTime || Infinity;
    let options = [];
    try {
      // Street graphs do not model internal station concourses; preserve these transfers.
      const concourse = /^[A-Z]/i.test(leg.from.code || '') && /^[A-Z]/i.test(leg.to.code || '');
      if (!concourse) options = await activeAlternatives(leg.from, leg.to);
    } catch { journey.walkingFallback = true; }
    const routed = options.length > 0;
    options = options.filter(o => earliest + o.durationSeconds * 1000 + (next ? 60000 : 0) <= latest);
    // A verified longer walk invalidates the connection, not the measured distance.
    if (routed && !options.length) return null;
    if (!options.length) leg.spatial = await walkingContext(leg.geometry);
    else {
      await Promise.all(options.map(async o => { o.spatial = await walkingContext(o.geometry); }));
      const cost = o => o.durationSeconds / 60 + (1-prefs.walking) * o.distanceMeters / 70 + prefs.shelter * (o.distanceMeters - (o.spatial.shelteredMeters || 0)) / 90;
      options.sort((a,b) => cost(a)-cost(b));
      Object.assign(leg, options[0]);
      // Keep scheduled transit departures intact; never stretch a walking leg past boarding.
      leg.startTime = next ? next.startTime - 60000 - leg.durationSeconds * 1000 : earliest;
      leg.endTime = leg.startTime + leg.durationSeconds * 1000;
    }
    leg.nearbyExit = await stationExit(leg.to.code ? leg.to : leg.from, leg.geometry);
  }
  journey.startTime = journey.legs[0].startTime;
  journey.endTime = journey.legs.at(-1).endTime;
  journey.durationSeconds = (journey.endTime - journey.startTime) / 1000;
  return journey;
}
