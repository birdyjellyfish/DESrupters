"use client";
import { useRef, useState } from 'react';
import { CalendarDays, Upload, X } from 'lucide-react';
export default function CalendarImport({ onSelect,events=[],onEvents=()=>{} }) {
  const [warnings,setWarnings] = useState([]), [error,setError] = useState(''), [busy,setBusy] = useState(false);
  const loaded=events.length>0;
  const input = useRef(null);
  const load = async event => {
    const file = event.target.files?.[0]; if (!file) return;
    setBusy(true); setError(''); setWarnings([]);
    try {
      if (file.size>2_000_000) throw new Error('Choose a calendar smaller than 2 MB.');
      const { upcomingEvents } = await import('../../lib/calendar.mjs');
      const result = upcomingEvents(await file.text());
      onEvents(result.events); setWarnings(result.warnings);
    } catch (e) { setError(e.message || 'Could not read this calendar.'); }
    finally { setBusy(false); if (input.current) input.current.value=''; }
  };
  const next = events.find(e => Date.parse(e.start)>Date.now());
  return <section className="rounded-3xl border border-fog bg-white p-5" aria-labelledby="calendar-title">
    <div className="flex items-center justify-between gap-3"><h2 id="calendar-title" className="flex items-center gap-2 text-sm font-bold"><CalendarDays size={18} /> Up next</h2>
      <button type="button" className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-bold text-moss hover:bg-cream" onClick={() => input.current?.click()} disabled={busy}><Upload size={14}/>{busy ? 'Reading…' : loaded ? 'Replace calendar' : 'Import calendar'}</button>
      <input ref={input} aria-label="Import ICS calendar" type="file" accept=".ics,.ical,text/calendar" className="hidden" onChange={load} />
    </div>
    {!loaded && <p className="mt-1 text-xs leading-relaxed text-moss">Import upcoming events. Saved on this device; off-site events take priority over home and work.</p>}
    {next ? <div className="mt-3"><p className="text-xs font-bold text-moss">{new Date(next.start).toLocaleString('en-SG',{timeZone:'Asia/Singapore',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} SGT</p><h3 className="mt-1 text-lg font-bold">{next.title}</h3><p className="mt-1 text-sm text-moss">{next.location || 'No location in this event'}</p><button type="button" disabled={!next.location || Date.parse(next.start)>Date.now()+30*86400000} onClick={() => onSelect(next)} className="mt-3 min-h-11 w-full rounded-2xl bg-fog px-4 text-sm font-bold disabled:opacity-50">Find this location & plan arrival</button>{Date.parse(next.start)>Date.now()+30*86400000 && <p className="mt-2 text-xs text-moss">Transit planning opens 30 days before the event.</p>}</div> : loaded && <p className="mt-2 text-sm text-moss">No upcoming timed events in the next 90 days.</p>}
    {loaded && <button type="button" className="mt-2 flex min-h-11 items-center gap-1 text-xs text-moss" onClick={() => { onEvents([]); setWarnings([]); onSelect(null); }}><X size={12}/>Clear calendar</button>}
    {warnings.map(w => <p className="mt-2 text-xs text-moss" key={w}>{w}</p>)}
    {error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
  </section>;
}
