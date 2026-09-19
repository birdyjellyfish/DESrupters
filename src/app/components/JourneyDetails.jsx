"use client";
import { Bus, TrainFront, Footprints, ChevronDown, AlertTriangle, Bike } from 'lucide-react';
import ServiceBadge from './ServiceBadge';
import CrowdBadge from './CrowdBadge';
export const time = value => new Date(value).toLocaleTimeString('en-SG', { timeZone:'Asia/Singapore',hour:'2-digit',minute:'2-digit' });
const friendly = value => value?.replace(/ MRT STATION| LRT STATION/gi,'') || '';
export default function JourneyDetails({ journey, stale }) {
  return <section aria-label="Step-by-step journey" className="rounded-3xl border border-fog bg-white p-5">
    <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Your journey</h2></div>
    <>{journey.bikePolicy && <p className="mt-3 rounded-xl bg-cream p-3 text-xs text-moss">{journey.bikePolicy}</p>}</><ol className="mt-5 space-y-5">
      {journey.legs.map((leg,index) => { const active = ['walk','cycle'].includes(leg.mode); const Icon = leg.mode==='walk' ? Footprints : leg.mode==='cycle' ? Bike : leg.mode==='bus' ? Bus : TrainFront;
        const previous=journey.legs[index-1];
        const transfer=previous && ['bus','rail'].includes(previous.mode) && ['bus','rail'].includes(leg.mode);
        return <li key={leg.id} className="relative border-l-2 border-fog pl-5">
          {transfer && <p className="mb-2 text-xs font-bold text-moss">Change at {friendly(leg.from.name)} · {Math.max(0,Math.floor((leg.startTime-previous.endTime)/60000))} min scheduled transfer</p>}
          <div className="mb-2 flex items-center justify-between gap-2"><span className="inline-flex items-center gap-2 text-xs font-bold"><Icon size={15}/>{active ? (leg.mode==='cycle'?'Cycle':'Walk') + ' · ' + Math.round(leg.distanceMeters) + ' m' : <ServiceBadge leg={leg}/>}</span><span className="shrink-0 text-xs text-moss">{Math.ceil(leg.durationSeconds/60)} min</span></div>
          <p className="text-sm font-bold">{friendly(leg.from.name)} → {friendly(leg.to.name)}</p>
          <p className="mt-1 text-xs text-moss">{time(leg.startTime)}–{time(leg.endTime)}{!active && ' · scheduled'}{leg.from.code && ` · ${leg.from.code}`}</p>
          {leg.bikeRequired && <p className="mt-2 text-xs text-moss">Bike needed at {friendly(leg.from.name)} · includes 2 min to get ready. Check availability.</p>}
          {leg.bikeAction && <p className="mt-2 text-xs font-bold text-moss">{leg.bikeAction}</p>}
          {leg.headsign && <p className="mt-1 text-xs text-moss">Direction: {leg.headsign}</p>}
          {leg.mode==='rail' && <div className="mt-2 rounded-xl bg-cream p-3 text-xs"><CrowdBadge level={leg.crowd.level} source={leg.crowd.source} comparison={leg.crowd.baseline?.comparison}/><details><summary className="min-h-11 cursor-pointer py-3 text-moss">Crowd details</summary><p>{stale?'Saved':leg.crowd.source==='forecast'?'Forecast':'Recent'} station crowd: <strong>{leg.crowd.label}</strong> at {friendly(leg.from.name)}</p><p>At {friendly(leg.to.name)}: {leg.arrivalCrowd?.label || 'Unavailable'}</p>{leg.crowd.reason && <p>{leg.crowd.reason}</p>}<p className="mt-2 text-moss">Station density, not carriage occupancy.{leg.crowd.observedAt && (' Observed '+time(leg.crowd.observedAt)+'.')}</p>{leg.crowd.baseline && <p className="mt-2 text-moss">{leg.crowd.baseline.source}. {leg.crowd.baseline.explanation}</p>}</details></div>}
          {leg.mode==='bus' && <div className="mt-2 rounded-xl bg-cream p-3 text-xs"><CrowdBadge level={leg.crowd.level} comparison={leg.crowd.baseline?.comparison}/>{leg.crowd.baseline && <details><summary className="min-h-11 cursor-pointer py-3 text-moss">Historical comparison</summary><p>{leg.crowd.baseline.source}. {leg.crowd.baseline.explanation}</p></details>}<p className="font-bold">{stale ? 'Saved bus estimates — refresh before boarding' : 'Live arrivals at boarding stop'}</p>{leg.arrivals?.length ? <ul className="mt-2 space-y-2">{leg.arrivals.map((bus,i) => <li key={`${bus.at}-${i}`} className="flex justify-between gap-3"><span>{time(bus.at)}{!stale && ` · ${Date.parse(bus.at)<Date.now()-30000?'Due / may have departed':`${Math.max(0,Math.ceil((Date.parse(bus.at)-Date.now())/60000))} min`}`}</span><span>{bus.occupancy}{bus.type && ` · ${bus.type}`}{bus.wheelchair && ' · Wheelchair accessible'}</span></li>)}</ul> : <p className="mt-1">Arrival and occupancy unavailable; use the scheduled time above.</p>}{leg.crowd.observedAt && <p className="mt-2 text-moss">Checked {time(leg.crowd.observedAt)}.</p>}{leg.currentOnly && <p className="mt-2 text-moss">Current arrivals only—not a prediction for your later departure.</p>}</div>}
          {leg.alerts.map(alert => <p role="alert" key={alert} className="mt-2 flex gap-2 rounded-xl border-2 border-dashed border-coral p-3 text-xs text-red-900"><AlertTriangle className="shrink-0" size={16}/>{alert}</p>)}
          {leg.mode==='walk' && leg.spatial?.available && <p className="mt-2 text-xs text-moss">About {Math.round(Math.min(leg.distanceMeters,leg.spatial.shelteredMeters))} m under mapped shelter{leg.spatial.crossingMeters>0 ? ' · bridge/underpass on route' : ''}</p>}
          {leg.nearbyExit && <p className="mt-2 text-xs text-moss">Mapped nearby: {leg.nearbyExit.name}, {friendly(leg.nearbyExit.station)}. Follow station signs; entrance access is not live-verified.</p>}
          <details className="mt-2"><summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-xs font-bold text-moss">{active ? (leg.mode==='cycle' ? 'Cycling directions' : 'Walking directions') : `${leg.stops.length+1} stops · boarding details`}<ChevronDown size={14}/></summary>
            {active ? <><ol className="space-y-2 text-xs leading-relaxed">{leg.instructions.length ? leg.instructions.map((s,i) => <li key={i}>{i+1}. {s.text}{s.meters>0 && <span className="text-moss"> · {s.meters} m</span>}</li>) : <li>Detailed path instructions unavailable. Follow the mapped path and local signs.</li>}</ol><p className="mt-2 text-[11px] text-moss">{leg.geometrySource}</p></> : <><p className="text-xs leading-relaxed">Board {leg.mode==='bus' ? <ServiceBadge leg={leg}/> : leg.lineName} at {friendly(leg.from.name)} ({leg.from.code}).{leg.stops[0] && ` Next stop: ${friendly(leg.stops[0].name)}.`} Alight at {friendly(leg.to.name)} ({leg.to.code}).</p><ol className="mt-3 space-y-2 text-xs text-moss">{[...leg.stops,leg.to].map((s,i) => <li key={`${s.code}-${i}`}>{i+1}. {friendly(s.name)} {s.code}</li>)}</ol></>}
          </details>
        </li>;
      })}
    </ol>
  </section>;
}
