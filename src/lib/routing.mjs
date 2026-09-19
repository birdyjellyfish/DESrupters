export const ARJUN = { shelter: 0.5, walking: 0.5, crowd: 1, cycling: 1, flexibility: 1, bike: 'folding' };
export const LINE_CODES = { EW: 'EWL', CG: 'EWL', EWL: 'EWL', NS: 'NSL', NSL: 'NSL', NE: 'NEL', NEL: 'NEL', CC: 'CCL', CE: 'CCL', CCL: 'CCL', DT: 'DTL', DTL: 'DTL', TE: 'TEL', TEL: 'TEL', BP: 'BPL', BPL: 'BPL', BPLRT: 'BPL', ST: 'STL', SE: 'STL', SW: 'STL', STL: 'STL', SLRT: 'STL', PT: 'PTL', PE: 'PTL', PW: 'PTL', PTL: 'PTL', PLRT: 'PTL' };
export function lineCode(value = '') { const code = String(value).toUpperCase().replace(/^.*:/, '').replace(/\d+$/, ''); return LINE_CODES[code] || null; }
export function point(value) {
  if (!value || value.lat === '' || value.lon === '' || value.lat == null || value.lon == null) throw new Error('Choose both locations from the search results.');
  const lat = Number(value.lat), lon = Number(value.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 1.1 || lat > 1.5 || lon < 103.5 || lon > 104.2) throw new Error('Choose locations within Singapore.');
  return { lat, lon, label: String(value.label || value.name || 'Selected location').slice(0,200) };
}
export function preferences(value = ARJUN) {
  const numeric = Object.fromEntries(Object.keys(ARJUN).filter(k=>k!=='bike').map(key => { const n = Number(value[key] ?? ARJUN[key]); if (!Number.isFinite(n) || n < 0 || n > 1) throw new Error('Preferences must be between 0 and 1.'); return [key,n]; }));
  const bike = value.bike ?? 'folding';
  if (!['none','folding','park'].includes(bike)) throw new Error('Choose a valid bicycle option.');
  return {...numeric,bike,cycling:bike==='none'?0:numeric.cycling};
}
// Canonical alert codes and crowd-feed request codes are different vocabularies.
export function crowdLine(code = '', station = '') {
  if (/^CG\d/i.test(station) || code === 'CGL') return 'CGL';
  if (/^CE\d/i.test(station) || code === 'CEL') return 'CEL';
  return {PTL:'PLRT',STL:'SLRT'}[code] || code;
}
export function decodePolyline(encoded = '', precision = 5) {
  let i = 0, lat = 0, lon = 0; const coords = [];
  const read = () => {
    let result = 0, shift = 0, byte;
    do { if (i >= encoded.length || shift > 30) throw new Error('Invalid route geometry'); byte = encoded.charCodeAt(i++) - 63; if (byte < 0 || byte > 63) throw new Error('Invalid route geometry'); result |= (byte & 31) << shift; shift += 5; } while (byte >= 32);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < encoded.length) { lat += read(); lon += read(); coords.push([lon / 10 ** precision, lat / 10 ** precision]); }
  return coords;
}
export function singaporeDateTime(date) {
  const d = new Date(date.getTime() + 8 * 3600_000).toISOString();
  return { date: `${d.slice(5,7)}-${d.slice(8,10)}-${d.slice(0,4)}`, time: d.slice(11,19) };
}
export function normalizeItinerary(item, index) {
  const legs = (item.legs || []).map((leg, i) => {
    const mode = leg.mode === 'WALK' ? 'walk' : leg.mode === 'BUS' ? 'bus' : ['SUBWAY','RAIL','TRAM'].includes(leg.mode) ? 'rail' : 'other';
    const station = p => ({ name: p?.name || 'Stop', lat: Number(p?.lat), lon: Number(p?.lon), code: String(p?.stopCode || p?.stopId?.split(':').pop() || '') });
    return { id: `${index}-${i}`, mode, from: station(leg.from), to: station(leg.to),
      service: leg.routeShortName || leg.route || '', line: mode === 'rail' ? lineCode(leg.routeShortName) || lineCode(leg.from?.stopCode) : null,
      lineName: leg.routeLongName || leg.route || '', headsign: leg.headsign || leg.tripHeadsign || '',
      startTime: Number(leg.startTime), endTime: Number(leg.endTime), durationSeconds: Number(leg.duration || 0), distanceMeters: Number(leg.distance || 0),
      stops: (leg.intermediateStops || []).map(station), geometry: decodePolyline(leg.legGeometry?.points),
      instructions: (leg.steps || []).map(s => ({ text: `${s.relativeDirection === 'DEPART' ? 'Head ' + (s.absoluteDirection || '').toLowerCase() : (s.relativeDirection || 'Continue').replaceAll('_',' ').toLowerCase()}${s.streetName ? ' on ' + s.streetName : ''}`, meters: Math.round(s.distance || 0) })),
      geometrySource: 'OneMap', timingSource: 'scheduled', crowd: { label: 'Unavailable', level: null }, alerts: [] };
  });
  return { id: `journey-${index}`, startTime: Number(item.startTime), endTime: Number(item.endTime), durationSeconds: Number(item.duration), transfers: Number(item.transfers || 0), fare: item.fare || null, legs };
}
export function journeyGeojson(journey) {
  return {type:'FeatureCollection',features:journey.legs.flatMap((leg,index)=>{
    const properties={mode:leg.mode,affected:leg.alerts.length>0,label:leg.mode==='walk'?'Walk':leg.mode==='cycle'?'Cycle':leg.service,index};
    const coordinates=leg.geometry;
    const feature=(points,affected)=>({type:'Feature',properties:{...properties,affected},geometry:{type:'LineString',coordinates:points}});
    if(coordinates.length<2 || !properties.affected || !leg.disruptionStations?.length)return [feature(coordinates,properties.affected)];
    const stops=[leg.from,...leg.stops,leg.to],affected=stops.filter(s=>leg.disruptionStations.includes(s.code) && Number.isFinite(s.lon) && Number.isFinite(s.lat));
    if(!affected.length)return [feature(coordinates,true)];
    const nearest=s=>coordinates.reduce((best,c,i)=>Math.hypot(c[0]-s.lon,c[1]-s.lat)<Math.hypot(coordinates[best][0]-s.lon,coordinates[best][1]-s.lat)?i:best,0);
    const indices=affected.map(nearest),start=Math.min(...indices),end=Math.max(...indices);
    // A single affected station includes its immediately adjacent track geometry.
    const from=start===end?Math.max(0,start-1):start,to=start===end?Math.min(coordinates.length-1,end+1):end;
    return [feature(coordinates.slice(0,from+1),false),feature(coordinates.slice(from,to+1),true),feature(coordinates.slice(to),false)];
  }).filter(f=>f.geometry.coordinates.length>=2)};
}
export function scoreJourney(journey, prefs) {
  const walking = journey.legs.filter(l => l.mode === 'walk');
  const walkingMeters = walking.reduce((n,l) => n + l.distanceMeters,0);
  const cyclingMeters = journey.legs.filter(l => l.mode === 'cycle').reduce((n,l) => n + l.distanceMeters,0);
  const known = walking.every(l => l.spatial?.available);
  const shelteredMeters = known ? walking.reduce((n,l) => n + Math.min(l.distanceMeters, l.spatial.shelteredMeters),0) : null;
  const transit = journey.legs.filter(l => ['rail','bus'].includes(l.mode));
  // Unknown crowding is penalised conservatively, never treated as an empty train/bus.
  const crowdCost = transit.reduce((n,l) => n + ({ l: 0, m: 6, h: 22 }[l.crowd?.level] ?? 10) + (l.crowd?.baseline?.comparison === 'more' ? 8 : 0) + (prefs.bike==='folding' && l.crowd?.level==='h' ? 10 : 0), 0);
  const affected = transit.some(l => l.alerts?.length);
  const uncovered = shelteredMeters === null ? walkingMeters * 0.75 : walkingMeters - shelteredMeters;
  // Folding-bike commuters trade a little time for avoiding another bus boarding.
  const bikeBoardingCost=prefs.bike==='folding'?(prefs.cycling || 0)*transit.filter(l=>l.mode==='bus').length*8:0;
  const score = journey.durationSeconds / 60 + (journey.departureOffsetMinutes || 0)*0.3 + (1 - prefs.walking) * walkingMeters / 70 + (1 - (prefs.cycling ?? 0)) * cyclingMeters / 180 + prefs.shelter * (uncovered + cyclingMeters * 0.75) / 90 + prefs.crowd * crowdCost + bikeBoardingCost + journey.transfers * 2 + (affected ? 1000 : 0);
  const levels = transit.map(l=>l.crowd?.level);
  const crowdLevel = levels.includes('h') ? 'h' : levels.some(l=>!l) ? null : levels.includes('m') ? 'm' : levels.length ? 'l' : 'none';
  const comparison = transit.some(l=>l.crowd?.baseline?.comparison==='more') ? 'more' : transit.length && transit.every(l=>l.crowd?.baseline?.comparison==='less') ? 'less' : null;
  return { ...journey, score, walkingMeters: Math.round(walkingMeters), cyclingMeters: Math.round(cyclingMeters), shelteredMeters, affected,
    crowdLevel, crowdComparison:comparison,
    reasons: [walkingMeters ? `${Math.round(walkingMeters)} m walking` : 'Minimal walking', ...(known && walkingMeters ? [`${Math.round(100 * shelteredMeters / walkingMeters)}% mapped shelter`] : []), ...(affected ? ['Affected by disruption'] : [])], geojson: journeyGeojson(journey) };
}
