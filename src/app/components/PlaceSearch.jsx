"use client";
import { useEffect, useId, useRef, useState } from 'react';
import { Check, MapPin, Search } from 'lucide-react';

export default function PlaceSearch({ label, value, onChange, seed = '' }) {
  const id = useId();
  const [query,setQuery] = useState(value?.label || seed);
  const [results,setResults] = useState([]), [open,setOpen] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState(''), [active,setActive] = useState(-1);
  const root = useRef(null);
  const editingSelection = useRef(false);
  useEffect(() => {
    if (value) { setQuery(value.label); setOpen(false); }
    else if (!editingSelection.current) setQuery(seed);
    editingSelection.current=false;
  }, [value]);
  useEffect(() => { if (!value) { setQuery(seed); setOpen(Boolean(seed)); } }, [seed]);
  useEffect(() => {
    const outside = e => { if (!root.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown',outside); return () => document.removeEventListener('pointerdown',outside);
  }, []);
  useEffect(() => {
    if (!open || query.trim().length < 2 || query === value?.label) { setBusy(false); setResults([]); return; }
    const controller = new AbortController();
    setBusy(true); setError(''); setResults([]); setActive(-1);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Search unavailable');
        setResults(data.results || []);
      } catch (e) { if (e.name !== 'AbortError') setError(e.message); }
      finally { if (!controller.signal.aborted) setBusy(false); }
    },350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query,open,value]);
  const choose = item => { onChange(item); setQuery(item.label); setOpen(false); setActive(-1); };
  return <div className="relative" ref={root}>
    <label htmlFor={id} className="mb-2 block text-xs font-bold text-moss">{label}</label>
    <div className="flex items-center gap-2 rounded-2xl border border-fog bg-white px-3">
      <MapPin size={18} className="shrink-0 text-moss" aria-hidden="true" />
      <input id={id} value={query} role="combobox" aria-autocomplete="list" aria-controls={`${id}-options`} aria-expanded={open} aria-activedescendant={active>=0 ? `${id}-${active}` : undefined}
        className="min-h-12 w-full min-w-0 bg-transparent py-3 text-sm outline-none" placeholder="Address, landmark or postal code" autoComplete="off"
        onFocus={() => setOpen(true)} onChange={e => { setQuery(e.target.value); if (value) { editingSelection.current=true; onChange(null); } setOpen(true); }}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false); if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(results.length-1,a+1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0,a-1)); } if (e.key === 'Enter' && open && active>=0 && results[active]) { e.preventDefault(); choose(results[active]); } }} />
      {value ? <Check size={16} className="text-moss" aria-label="Location selected" /> : <Search size={16} className="text-moss" aria-hidden="true" />}
    </div>
    {open && query.length>=2 && query!==value?.label && <div className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-fog bg-white shadow-soft">
      <ul id={`${id}-options`} role="listbox" aria-label={`${label} suggestions`}>
        {results.map((r,i) => <li id={`${id}-${i}`} key={`${r.lat},${r.lon},${i}`} role="option" aria-selected={active===i}>
          <button type="button" onClick={() => choose(r)} className={`min-h-14 w-full border-b border-fog px-4 py-3 text-left text-sm ${active===i ? 'bg-fog' : 'hover:bg-cream'}`}><span className="block font-bold">{r.label}</span><span className="block text-xs text-moss">{r.address}</span></button>
        </li>)}
      </ul>
      {(busy || error || !results.length) && <p role="status" className="p-4 text-sm text-moss">{busy ? 'Searching OneMap…' : error || 'No locations found. Try a street or postal code.'}</p>}
    </div>}
  </div>;
}
