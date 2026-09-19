import { cached } from './cache.mjs';
import { singaporeDateTime, normalizeItinerary, decodePolyline } from '../routing.mjs';
export async function oneMap(path, params) {
  const key = process.env.ONEMAP_KEY || process.env.ONEMAP_API_KEY || process.env.ONEMAP_ACCESS_TOKEN;
  if (!key) throw new Error('Configure ONEMAP_KEY on the server to search and plan transit journeys.');
  const response = await fetch(`https://www.onemap.gov.sg${path}?${new URLSearchParams(params)}`, {
    headers: { Authorization: key, Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(18_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    if ([401,403].includes(response.status)) throw new Error('OneMap rejected the configured key. Check its validity and routing access.');
    if (response.status === 429) throw new Error('OneMap is rate-limiting requests. Try again shortly.');
    if (response.status === 404 || data.error?.message?.includes('route')) throw new Error('No transit service was found for this departure. Try a time during operating hours or a nearby stop.');
    throw new Error(`OneMap could not find this journey (${response.status}). Try a different departure time or location.`);
  }
  return data;
}
export async function searchPlaces(query) {
  return cached(`search:v2:${query.toLowerCase()}`, 3600, async () => {
    const search = searchVal => oneMap('/api/common/elastic/search', { searchVal, returnGeom: 'Y', getAddrDetails: 'Y', pageNum: '1' });
    let data = await search(query);
    // OneMap's literal search can miss names with "and" versus "&", e.g. CAPT.
    const keywords = query.replace(/\b(and|of|the)\b|&/gi,' ').replace(/\s+/g,' ').trim();
    if (!data.results?.length && keywords.length >= 2 && keywords !== query) data = await search(keywords);
    return (data.results || []).slice(0,8).map(r => ({ label: r.SEARCHVAL || r.ADDRESS, address: r.ADDRESS, postal: r.POSTAL, lat: Number(r.LATITUDE), lon: Number(r.LONGITUDE) })).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lon));
  });
}
export async function activePath(origin, destination, mode) {
  return cached(`onemap:${mode}:${origin.lat},${origin.lon}:${destination.lat},${destination.lon}`, 3600, async () => {
    const data = await oneMap('/api/public/routingsvc/route', { start: `${origin.lat},${origin.lon}`, end: `${destination.lat},${destination.lon}`, routeType: mode });
    const distanceMeters = Number(data.route_summary?.total_distance), durationSeconds = Number(data.route_summary?.total_time);
    const geometry = decodePolyline(data.route_geometry);
    if (!Number.isFinite(distanceMeters) || distanceMeters <= 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || geometry.length < 2) throw new Error('No mapped active route found.');
    return { distanceMeters, durationSeconds, geometry, geometrySource: 'OneMap', instructions: (data.route_instructions || []).map(s => ({ text: String(s[9] || `${s[0]} ${s[1] || ''}`).trim(), meters: Math.round(Number(s[2]) || 0) })) };
  });
}
export async function transitJourneys(origin, destination, departure, prefs, mode = 'transit') {
  const parameters = { start: `${origin.lat},${origin.lon}`, end: `${destination.lat},${destination.lon}`, routeType: 'pt', mode, ...singaporeDateTime(departure), maxWalkDistance: String(Math.round(400 + prefs.walking * 2100)), numItineraries: '3' };
  const data = await cached(`transit:v2:${JSON.stringify(parameters)}`,120,()=>oneMap('/api/public/routingsvc/route', parameters));
  return (data.plan?.itineraries || data.itineraries || []).slice(0,3).map(normalizeItinerary).filter(j => j.legs.length && j.legs.some(l => l.mode === 'rail' || l.mode === 'bus'));
}
export async function journeyCandidates(origin,destination,departure,prefs) {
  // Distinct modal requests provide genuine alternatives rather than three departures on one line.
  const results = await Promise.allSettled(['transit','rail','bus'].map(mode => transitJourneys(origin,destination,departure,prefs,mode)));
  const candidates = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  if (!candidates.length && results.every(r => r.status === 'rejected')) throw results[0].reason;
  const unique = new Map();
  for (const j of candidates) {
    const key = j.legs.filter(l => l.mode !== 'walk').map(l => `${l.mode}:${l.service}:${l.from.code}:${l.to.code}`).join('|');
    if (!unique.has(key) || unique.get(key).endTime>j.endTime) unique.set(key,j);
  }
  return [...unique.values()].slice(0,6).map((j,i) => ({...j,id:`journey-${i}`,legs:j.legs.map((l,k)=>({...l,id:`${i}-${k}`}))}));
}
