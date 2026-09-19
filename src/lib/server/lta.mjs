import { cached } from './cache.mjs';
import { lineCode, crowdLine } from '../routing.mjs';
import { baselineData, typicalDemand } from './baselines.mjs';
const BASE = 'https://datamall2.mytransport.sg/ltaodataservice';
export const CROWD_TTL = 600;
export const FORECAST_TTL = 86400;
const values = data => Array.isArray(data?.value) ? data.value : [];
export async function lta(endpoint, ttl) {
  const day = endpoint.startsWith('PCDForecast') ? new Date(Date.now()+8*3600000).toISOString().slice(0,10) : '';
  return cached(`lta:v2:${endpoint}:${day}`, ttl, async () => {
    const key = process.env.LTA_ACCOUNT_KEY;
    if (!key) return { unavailable: true, reason:'DataMall key missing', observedAt: new Date().toISOString() };
    try {
      const response = await fetch(`${BASE}/${endpoint}`, { headers: { AccountKey: key, Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(7000) });
      if (!response.ok) return { unavailable: true, reason:`DataMall HTTP ${response.status}`, observedAt: new Date().toISOString() };
      const data=await response.json();
      if(endpoint.startsWith('PCD') && !Array.isArray(data.value)) return {unavailable:true,reason:'DataMall rejected this line or returned no data',observedAt:new Date().toISOString()};
      return { data, observedAt: new Date().toISOString(), ...(endpoint.startsWith('PCDRealTime') ? {cacheTtlSeconds:Math.max(1,Math.ceil((600000-Date.now()%600000)/1000))} : {}) };
    } catch { return { unavailable: true, reason:'DataMall connection unavailable', observedAt: new Date().toISOString() }; }
  });
}
export function normalizeAlerts(data) {
  const root = data?.value && !Array.isArray(data.value) ? data.value : data;
  if (!root || ![1,2].includes(Number(root.Status))) return { status: null, segments: [], messages: [] };
  return { status: Number(root.Status), segments: (root.AffectedSegments || []).map(s => ({ line: lineCode(s.Line), stations: String(s.Stations || '').split(/[,;\s]+/).filter(Boolean), direction: s.Direction, freeBus: s.FreePublicBus, shuttle: s.FreeMRTShuttle })), messages: (root.Message || []).map(m => String(m.Content || '')).filter(Boolean) };
}
export function affectedLeg(leg, alerts) {
  if (alerts.status !== 2 || leg.mode !== 'rail') return [];
  const stops = new Set([leg.from, ...leg.stops, leg.to].map(s => s.code));
  const matching = alerts.segments.filter(s => s.line === leg.line && (!s.stations.length || s.stations.some(s => stops.has(s))));
  if (!matching.length) return [];
  return alerts.messages.length ? alerts.messages : [`Disruption reported on ${leg.lineName}. Choose an unaffected alternative where available.`];
}
export function stationCrowd(record, code, now = Date.now()) {
  const station = values(record?.data).filter(s => s.Station === code).sort((a,b)=>Date.parse(b.EndTime)-Date.parse(a.EndTime))[0];
  const start = Date.parse(station?.StartTime), end = Date.parse(station?.EndTime);
  const valid = station && Number.isFinite(start) && Number.isFinite(end) && start <= now && now < end+600000 && ['l','m','h'].includes(station.CrowdLevel);
  const reason = record?.reason || (!station ? 'No reading for this station' : station.CrowdLevel==='NA' ? 'DataMall reports NA' : 'Reading expired');
  return { level: valid ? station.CrowdLevel : null, label: valid ? { l: 'Low', m: 'Moderate', h: 'High' }[station.CrowdLevel] : 'Unavailable', kind: 'station', source:'realtime', station: code, observedAt:station?.EndTime || record?.observedAt, validUntil:Number.isFinite(end)?new Date(end+600000).toISOString():null, intervalEnd:station?.EndTime, reason:valid?null:reason };
}
export function forecastCrowd(record, code, at) {
  const station=values(record?.data).flatMap(day=>day.Stations || []).find(s=>s.Station===code);
  const interval=station?.Interval?.find(i=>Date.parse(i.Start)<=at && at<Date.parse(i.Start)+1800000);
  const level=['l','m','h'].includes(interval?.CrowdLevel)?interval.CrowdLevel:null;
  return {level,label:{l:'Low',m:'Moderate',h:'High'}[level] || 'Unavailable',source:'forecast',kind:'station',station:code,observedAt:record?.observedAt,validUntil:interval?new Date(Date.parse(interval.Start)+1800000).toISOString():null,reason:level?null:record?.reason || 'No forecast for this departure'};
}
export function busArrivals(record, service, now = Date.now()) {
  const found = (record?.data?.Services || []).find(s => String(s.ServiceNo).toUpperCase() === String(service).toUpperCase());
  return ['NextBus','NextBus2','NextBus3'].map(key => found?.[key]).filter(b => b?.EstimatedArrival && Date.parse(b.EstimatedArrival) >= now - 30000).map(b => ({
    at: b.EstimatedArrival, minutes: Math.max(0, Math.ceil((Date.parse(b.EstimatedArrival) - now) / 60000)),
    occupancy: { SEA: 'Seats available', SDA: 'Standing available', LSD: 'Limited standing' }[b.Load] || 'Occupancy unavailable',
    level: { SEA: 'l', SDA: 'm', LSD: 'h' }[b.Load] || null, type: { SD: 'Single deck', DD: 'Double deck', BD: 'Bendy bus' }[b.Type] || '', wheelchair: b.Feature === 'WAB', observedAt: record.observedAt,
  }));
}
export async function serviceAlerts() {
  const record = await lta('TrainServiceAlerts', 60);
  return { ...normalizeAlerts(record.data), observedAt: record.observedAt };
}
export async function enrichJourneys(journeys, now = Date.now(), options = {}) {
  const legs = journeys.flatMap(j => j.legs);
  const lines = [...new Set(legs.filter(l => l.mode === 'rail' && l.line).flatMap(l => [crowdLine(l.line,l.from.code),crowdLine(l.line,l.to.code)]))];
  const stops = [...new Set(legs.filter(l => l.mode === 'bus' && /^\d{5}$/.test(l.from.code)).map(l => l.from.code))];
  const [liveAlerts, crowds, buses, forecasts, baseline] = await Promise.all([
    serviceAlerts(),
    Promise.all(lines.map(async line => [line, await lta(`PCDRealTime?TrainLine=${line}`, CROWD_TTL)])),
    Promise.all(stops.map(async stop => [stop, await lta(`v3/BusArrival?BusStopCode=${stop}`, 30)])),
    Promise.all(lines.map(async line => [line, await crowdForecast(line)])), baselineData(),
  ]);
  const alerts=options.alerts || liveAlerts;
  const crowdMap = new Map(crowds), busMap = new Map(buses), forecastMap=new Map(forecasts);
  for (const leg of legs) {
    leg.alerts = affectedLeg(leg, alerts);
    leg.disruptionStations = leg.alerts.length ? alerts.segments.filter(s=>s.line===leg.line).flatMap(s=>s.stations) : [];
    if (leg.mode === 'rail') {
      const fromLine=crowdLine(leg.line,leg.from.code),toLine=crowdLine(leg.line,leg.to.code);
      leg.currentCrowd = stationCrowd(crowdMap.get(fromLine), leg.from.code, now);
      leg.crowd = leg.startTime>now+600000 ? forecastCrowd(forecastMap.get(fromLine),leg.from.code,leg.startTime) : leg.currentCrowd;
      leg.arrivalCrowd = leg.endTime>now+600000 ? forecastCrowd(forecastMap.get(toLine),leg.to.code,leg.endTime) : stationCrowd(crowdMap.get(toLine), leg.to.code, now);
      leg.crowd.baseline=typicalDemand(baseline,'rail',leg.from.code,leg.startTime || now,leg.crowd.level);
    }
    if (leg.mode === 'bus') {
      leg.arrivals = busArrivals(busMap.get(leg.from.code), leg.service, now);
      const relevant=leg.startTime<=now+30*60000 ? leg.arrivals.find(a=>Math.abs(Date.parse(a.at)-leg.startTime)<=5*60000) : null;
      leg.crowd = { kind: 'bus', source:'realtime', level: relevant?.level || null, label: relevant?.occupancy || 'Unavailable', reason: relevant?null:'No live bus estimate matching this departure', observedAt: busMap.get(leg.from.code)?.observedAt };
      leg.crowd.baseline=typicalDemand(baseline,'bus',leg.from.code,leg.startTime || now,leg.crowd.level);
    }
    leg.currentOnly = leg.startTime > now + 30 * 60000;
  }
  return alerts;
}
export async function crowdForecast(line) { return lta(`PCDForecast?TrainLine=${line}`, FORECAST_TTL); }
