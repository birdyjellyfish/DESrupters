"use client";
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowRight, ArrowUpDown, SlidersHorizontal, WifiOff, RefreshCw, X, Bike, Footprints } from 'lucide-react';
import PlaceSearch from './PlaceSearch';
import Settings from './Settings';
import Welcome from './Welcome';
import ServiceBadge from './ServiceBadge';
import JourneyDetails, { time } from './JourneyDetails';
import { ARJUN, scoreJourney } from '../../lib/routing.mjs';
import Onboarding from './Onboarding';
import CrowdBadge from './CrowdBadge';
import { DEFAULT_ROUTINE,commuteIntent,detourAdvice } from '../../lib/commute.mjs';
import { DEMO_HOME,DEMO_WORK } from '../../lib/demo.mjs';
import { hasWatch,hasLocalAlerts,saveNotifications,disableNotifications,showDetourNotification } from '../../lib/notifications.mjs';
const LiveMap = dynamic(() => import('./LiveMap'), { ssr: false, loading: () => <div className="h-[340px] animate-pulse rounded-3xl bg-fog"/> });
const EMPTY = { type:'FeatureCollection',features:[] };
const STORAGE = 'wayfinder-active-journey-v3';
const SETTINGS = 'wayfinder-settings-v1';
export default function Planner() {
  const [origin,setOrigin] = useState(null), [destination,setDestination] = useState(null), [destinationSeed,setDestinationSeed] = useState('');
  const [profile,setProfile] = useState('arjun'), [prefs,setPrefs] = useState(ARJUN), [showPrefs,setShowPrefs] = useState(false);
  const [result,setResult] = useState(null), [selected,setSelected] = useState(0), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const [online,setOnline] = useState(true), [now,setNow] = useState(Date.now()), [event,setEvent] = useState(null), [departure,setDeparture] = useState('');
  const [savedNotice,setSavedNotice] = useState('');
  const [notificationBusy,setNotificationBusy]=useState(false);
  const notificationRequest=useRef(false);
  const [home,setHome]=useState(null),[work,setWork]=useState(null),[events,setEvents]=useState([]),[routine,setRoutine]=useState(DEFAULT_ROUTINE);
  const [onboarding,setOnboarding]=useState(false),[onboarded,setOnboarded]=useState(false),[notificationStatus,setNotificationStatus]=useState('');
  const [demo,setDemo]=useState({rain:false,disruption:false}),[advice,setAdvice]=useState(null),[suggestionLabel,setSuggestionLabel]=useState('');
  const autoIntent=useRef(''),lastAdvice=useRef(''),latest=useRef(null);
  const [layers,setLayers] = useState(true), [showAlternatives,setShowAlternatives] = useState(false), [settingsLoaded,setSettingsLoaded] = useState(false);
  const details = useRef(null), options = useRef(null), scrollToJourney = useRef(false);
  const form = useRef(null), request = useRef(null);
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
      if (!saved?.demo?.rain && !saved?.demo?.disruption && saved?.journeys?.length && Date.parse(saved.generatedAt)>Date.now()-7*86400000) { setResult(saved); setOrigin(saved.origin); setDestination(saved.destination); setPrefs({...ARJUN,...saved.preferences}); setProfile(JSON.stringify(saved.preferences)===JSON.stringify(ARJUN)?'arjun':'custom'); setSavedNotice('Restored your saved journey. Refresh before travelling.'); }
    } catch { /* storage is optional in private browsing */ }
    try { const saved = JSON.parse(localStorage.getItem(SETTINGS) || 'null'); if(saved) {setPrefs({...ARJUN,...saved.prefs});setProfile(saved.profile || 'arjun');setLayers(saved.layers !== false);setHome(saved.home || null);setWork(saved.work || null);setEvents(saved.events || []);setRoutine(saved.routine || DEFAULT_ROUTINE);setOnboarded(saved.onboarded===true);setOnboarding(saved.onboarded!==true);} else setOnboarding(true); } catch {setOnboarding(true);}
    setSettingsLoaded(true);
    if(hasWatch())setNotificationStatus('Detour notifications enabled.');
    else if(hasLocalAlerts())setNotificationStatus('Alerts work while this page is open. Retry enabling notifications for background delivery.');
    const update = () => setOnline(navigator.onLine);
    update(); window.addEventListener('online',update); window.addEventListener('offline',update);
    const timer = setInterval(() => setNow(Date.now()),15000);
    return () => { clearInterval(timer); window.removeEventListener('online',update); window.removeEventListener('offline',update); request.current?.abort(); };
  }, []);
  useEffect(() => {if(settingsLoaded) {try {localStorage.setItem(SETTINGS,JSON.stringify({profile,prefs,layers,home,work,events,routine,onboarded}));} catch {}}},[settingsLoaded,profile,prefs,layers,home,work,events,routine,onboarded]);
  const journey = result?.journeys?.[selected];
  useEffect(() => {
    if (scrollToJourney.current && result) { options.current?.scrollIntoView({behavior:'smooth',block:'start'}); scrollToJourney.current=false; }
  },[result]);
  const stale = !online || Boolean(savedNotice) || Boolean(result && now-Date.parse(result.liveUpdatedAt || result.generatedAt)>60000);
  const changed = result && ((!(result.demo?.rain||result.demo?.disruption) && JSON.stringify(result.preferences)!==JSON.stringify(prefs)) || result.origin.lat!==origin?.lat || result.origin.lon!==origin?.lon || result.destination.lat!==destination?.lat || result.destination.lon!==destination?.lon);
  useEffect(() => {
    if (!result || !online || savedNotice) return;
    let controller, pending=false;
    const snapshot=result.generatedAt;
    const timer=setInterval(async()=>{
      if(document.hidden || !navigator.onLine || pending || busy)return;
      pending=true;controller=new AbortController();
      try {
        const journeys=result.journeys.map(j=>({id:j.id,legs:j.legs.map(l=>({id:l.id,mode:l.mode,line:l.line,lineName:l.lineName,service:l.service,from:{code:l.from.code},to:{code:l.to.code},stops:l.stops.map(s=>({code:s.code})),startTime:l.startTime,endTime:l.endTime}))}));
        const response=await fetch('/api/transit/journey',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({journeys,demo:result.demo}),signal:controller.signal});
        if(!response.ok)return;
        const live=await response.json();
        setResult(previous=>{
          if(!previous || previous.generatedAt!==snapshot)return previous;
          const next={...previous,liveUpdatedAt:live.updatedAt,alerts:live.alerts,journeys:previous.journeys.map(j=>{
            const updated=live.journeys.find(x=>x.id===j.id);
            const legs=j.legs.map(l=>{const fresh=updated?.legs.find(x=>x.id===l.id);return fresh?{...l,crowd:fresh.crowd || l.crowd,arrivalCrowd:fresh.arrivalCrowd,arrivals:fresh.arrivals,alerts:fresh.alerts,disruptionStations:fresh.disruptionStations,currentOnly:fresh.currentOnly,currentCrowd:fresh.currentCrowd}:l;});
            return scoreJourney({...j,legs},previous.preferences);
          })};
          try{localStorage.setItem(STORAGE,JSON.stringify(next));}catch{}
          return next;
        });
      } catch {} finally {pending=false;}
    },30000);
    return()=>{clearInterval(timer);controller?.abort();};
  },[result?.generatedAt,online,savedNotice,busy]);
  async function plan(e,override={}) {
    const start=override.origin || origin,end=override.destination || destination,scenario=override.demo || demo,chosenPrefs=override.preferences || (scenario.rain||scenario.disruption?ARJUN:prefs);
    const arrival=override.arriveBy !== undefined?override.arriveBy:event?.start;
    const requestedDeparture=override.departure !== undefined?override.departure:departure;
    e?.preventDefault(); if (!start || !end) { setError('Select both locations from OneMap suggestions first.'); return; }
    if (!online) { setError('You are offline. Your last saved journey remains available below.'); return; }
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/route', { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({origin:start,destination:end,preferences:chosenPrefs,demo:scenario,departure:requestedDeparture ? new Date(`${requestedDeparture}:00+08:00`).toISOString() : undefined,arriveBy:arrival}),signal:controller.signal });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to plan journey.');
      scrollToJourney.current=true;
      setResult(data); setAdvice(null); setSelected(0); setShowAlternatives(false); setSavedNotice(data.offline ? 'Offline · restored matching saved journey.' : ''); setNow(Date.now());
      try { localStorage.setItem(STORAGE,JSON.stringify(data)); } catch { setSavedNotice('This browser could not save the journey for offline use.'); }
    } catch (e) { if (e.name!=='AbortError') setError(e.message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function calendarSelect(item) { setEvent(item); setDestination(null); setDestinationSeed(item?.location || ''); if(item?.place)setDestination(item.place); setDeparture(''); form.current?.scrollIntoView({behavior:'smooth',block:'start'}); }
  latest.current={result,journey,origin,destination,prefs,demo,busy,online,departure,event,changed};
  const notificationConfig={home,work,events,routine,preferences:prefs};
  async function enableAlerts(){
    if(notificationRequest.current)return;
    notificationRequest.current=true;setNotificationBusy(true);setNotificationStatus('Connecting to notifications…');
    try{const status=await saveNotifications(notificationConfig,true);setNotificationStatus(status.message || (status.monitorActive?'Enabled. We check near your commute times.':'Saved. Background monitoring is offline; in-app detour alerts remain available.'));}
    catch(e){setNotificationStatus(e.message);}
    finally{notificationRequest.current=false;setNotificationBusy(false);}
  }
  async function disableAlerts(){try{await disableNotifications();setNotificationStatus('Notifications off.');}catch(e){setNotificationStatus(e.message);}}
  useEffect(()=>{if(!settingsLoaded || !hasWatch())return;const timer=setTimeout(()=>saveNotifications({home,work,events,routine,preferences:prefs}).catch(e=>setNotificationStatus(e.message)),1500);return()=>clearTimeout(timer);},[settingsLoaded,home,work,events,routine,prefs]);
  useEffect(()=>{
    if(!settingsLoaded || onboarding || !onboarded)return;
    const intent=commuteIntent({home,work,events,routine});
    const key=JSON.stringify(intent);
    if(!intent || autoIntent.current===key)return;
    autoIntent.current=key;setSuggestionLabel(intent.label);setEvent(intent.event || null);setDestinationSeed(intent.seed || '');
    if(intent.origin)setOrigin(intent.origin);
    if(intent.destination){setDestination(intent.destination);setDeparture('');if(intent.origin)plan(null,{origin:intent.origin,destination:intent.destination,arriveBy:intent.event?.start || null,departure:null,demo:{rain:false,disruption:false}});}
    else {
      setDestination(null);
      const controller=new AbortController();
      fetch('/api/geocode?q='+encodeURIComponent(intent.seed),{signal:controller.signal}).then(r=>r.json()).then(data=>{
        if(data.results?.length===1){const place=data.results[0];setDestination(place);setEvents(previous=>previous.map(e=>e.id===intent.event.id?{...e,place}:e));}
      }).catch(()=>{});
      return()=>controller.abort();
    }
  },[settingsLoaded,onboarding,onboarded,home,work,events,routine]);
  useEffect(()=>{
    if(!event || !destination)return;
    setEvents(previous=>previous.map(e=>e.id===event.id && (e.place?.lat!==destination.lat || e.place?.lon!==destination.lon)?{...e,place:destination}:e));
  },[event?.id,destination]);
  useEffect(()=>{
    let pending=false,controller;
    const check=async()=>{
      const state=latest.current;
      if(pending || state.busy || state.changed || !state.online || !state.result || !state.journey || !state.origin || !state.destination)return;
      pending=true;controller=new AbortController();
      try {
        const r=await fetch('/api/route',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({origin:state.origin,destination:state.destination,preferences:state.result.preferences,demo:state.result.demo,arriveBy:Date.parse(state.event?.start)>Date.now()?state.event.start:undefined})});
        if(!r.ok)return;const next=await r.json(),notice=detourAdvice(state.journey,next);
        if(latest.current.result?.generatedAt!==state.result.generatedAt || latest.current.changed)return;
        if(notice && notice.key!==lastAdvice.current){lastAdvice.current=notice.key;setAdvice({...notice,result:next});if(!state.result.demo?.rain && !state.result.demo?.disruption)showDetourNotification(notice).catch(()=>{});}
      }catch{}finally{pending=false;}
    };
    const timer=setInterval(check,120000),message=e=>{if(e.data?.type==='REFRESH_COMMUTE')check();};
    navigator.serviceWorker?.addEventListener('message',message);
    return()=>{clearInterval(timer);controller?.abort();navigator.serviceWorker?.removeEventListener('message',message);};
  },[]);
  function runDemo(){setEvent(null);setDeparture('');if(demo.rain||demo.disruption){setOrigin(DEMO_HOME);setDestination(DEMO_WORK);setSuggestionLabel('');plan(null,{origin:DEMO_HOME,destination:DEMO_WORK,preferences:ARJUN,demo,arriveBy:null,departure:null});}else{setResult(null);setAdvice(null);setSuggestionLabel('');autoIntent.current='';setOrigin(home);setDestination(work);}}
  function locate() {
    if (!navigator.geolocation) { setError('This browser does not support location access.'); return; }
    navigator.geolocation.getCurrentPosition(position => { const {latitude:lat,longitude:lon}=position.coords; if(lat<1.1||lat>1.5||lon<103.5||lon>104.2) setError('Your current location is outside Singapore. Search for an origin instead.'); else setOrigin({label:'My current location',lat,lon}); }, () => setError('Location access was denied or unavailable. Search for an origin instead.'), {timeout:10000,maximumAge:60000});
  }
  return <main className="mx-auto min-h-screen max-w-[520px] bg-cream px-4 pb-10 pt-6 text-ink">
    <header className="mb-6 flex items-center justify-between"><a href="/" className="flex min-h-11 items-center gap-2 text-xl font-bold tracking-tight"><img src="/branding/wayfinder-bird-512.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 object-contain"/>wayfinder<span className="text-moss">.</span></a><button type="button" aria-label="Open settings" onClick={() => setShowPrefs(true)} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white"><SlidersHorizontal size={20}/></button></header>
    <Settings onOnboarding={()=>setOnboarding(true)} open={showPrefs} onClose={() => setShowPrefs(false)} profile={profile} setProfile={setProfile} prefs={prefs} setPrefs={setPrefs} layers={layers} setLayers={setLayers} onCalendarSelect={calendarSelect} events={events} onEvents={setEvents} home={home} setHome={setHome} work={work} setWork={setWork} routine={routine} setRoutine={setRoutine} demo={demo} setDemo={setDemo} onDemo={runDemo} notificationBusy={notificationBusy} notificationStatus={notificationStatus} onNotifications={enableAlerts} onDisableNotifications={disableAlerts}/>
    <Onboarding open={onboarding} onComplete={()=>{setOnboarded(true);setOnboarding(false);}} home={home} setHome={setHome} work={work} setWork={setWork} prefs={prefs} setPrefs={v=>{setPrefs(v);setProfile('custom');}} routine={routine} setRoutine={setRoutine}/>
    <Welcome profile={profile} origin={origin} journey={journey} alerts={result?.alerts} online={online} stale={stale} now={now} weather={result?.weather} demo={result?.demo}/>
    {!online && <p role="status" className="mb-4 flex items-center gap-2 rounded-2xl bg-amber/20 p-3 text-sm"><WifiOff size={18}/>Offline · saved directions, not live updates</p>}
    {suggestionLabel && <p className="mb-3 text-sm font-bold text-moss">{suggestionLabel}</p>}
    {advice && <section role="status" className="mb-4 rounded-2xl border-2 border-moss bg-white p-4"><h2 className="font-bold">{advice.title}</h2><p className="mt-2 text-sm">{advice.body}</p><button type="button" onClick={()=>{setResult(advice.result);setSelected(0);setAdvice(null);setSavedNotice('');try{localStorage.setItem(STORAGE,JSON.stringify(advice.result));}catch{}}} className="mt-3 min-h-12 w-full rounded-xl bg-ink text-sm font-bold text-white">Take this detour</button></section>}
    <form ref={form} onSubmit={plan} className="scroll-mt-4 rounded-3xl border border-fog bg-white p-5 shadow-card">
      <div className="flex items-center justify-between"><h2 className="text-sm font-bold">Where are you heading?</h2><button type="button" onClick={locate} className="min-h-11 rounded-xl px-2 text-xs font-bold text-moss">Use my location</button></div>
      <PlaceSearch label="From" value={origin} onChange={setOrigin}/>
      <div className="flex justify-end"><button type="button" aria-label="Swap origin and destination" onClick={() => {setOrigin(destination);setDestination(origin);setDestinationSeed('');setEvent(null);}} className="flex min-h-11 min-w-11 items-center justify-center text-moss"><ArrowUpDown size={17}/></button></div>
      <PlaceSearch label="To" value={destination} onChange={setDestination} seed={destinationSeed}/>
      {event && <div className="mt-3 flex items-start justify-between gap-2 rounded-xl bg-cream p-3 text-xs"><p>Arrive for <strong>{event.title}</strong><br/>{new Date(event.start).toLocaleString('en-SG',{timeZone:'Asia/Singapore',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})} SGT. Confirm the matching location above.</p><button type="button" aria-label="Clear event arrival time" className="flex min-h-11 min-w-11 items-center justify-center" onClick={() => setEvent(null)}><X size={16}/></button></div>}
      {!event && <details className="mt-2"><summary className="min-h-11 cursor-pointer py-3 text-xs font-bold text-moss">{departure ? 'Scheduled departure' : 'Leave now'} · change</summary><label className="block text-xs text-moss">Departure (Singapore time)<input type="datetime-local" value={departure} onChange={e => setDeparture(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-fog bg-cream px-3"/></label><button type="button" onClick={() => setDeparture('')} className="min-h-11 text-xs font-bold text-moss">Reset to now</button></details>}
      {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
      <button type="submit" disabled={busy||!online||!origin||!destination} className="mt-4 flex min-h-14 w-full items-center justify-between rounded-2xl bg-ink px-5 text-sm font-bold text-white disabled:opacity-50"><span>{busy?'Finding your way…':"Let's go"}</span>{busy?<RefreshCw size={18} className="animate-spin"/>:<ArrowRight size={18}/>}</button>
    </form>
    {journey && <section ref={options} className="mt-6 scroll-mt-4" aria-label="Journey options">
      {(changed||stale) && <p role="status" className="mb-3 rounded-xl bg-amber/20 p-3 text-xs">{changed?"Preferences or locations changed. Tap Let's go to update.":savedNotice||'Saved journey · refresh for live updates.'}</p>}
      <button type="button" onClick={() => details.current?.scrollIntoView({behavior:'smooth',block:'start'})} className="w-full rounded-t-3xl rounded-b-lg bg-ink p-5 text-left text-white shadow-card">
        <span className="flex items-center justify-between text-xs"><span>{selected===0?'Recommended journey':'Selected journey'}{journey.affected?' · disruption':''}</span><ArrowRight size={18}/></span>
        <span className="mt-2 block text-3xl font-bold">{Math.ceil(journey.durationSeconds/60)} <span className="text-sm font-normal">min · arrive {time(journey.endTime)}</span></span>
        <RouteSummary journey={journey}/><span className="mt-3 block"><CrowdBadge level={journey.crowdLevel} comparison={journey.crowdComparison} source={journey.legs.some(l=>l.crowd?.source==='forecast')?'forecast':undefined}/></span><span className="mt-2 block text-xs">Leave {time(journey.startTime)}{journey.departureOffsetMinutes>0 && (' · '+journey.departureOffsetMinutes+' min later')}{journey.initialWaitSeconds>=60 && (' · includes '+Math.ceil(journey.initialWaitSeconds/60)+' min waiting')}</span>
        {journey.cyclingMeters>0 && <span className="mt-2 block text-xs text-white/80">{result.preferences.bike==='folding'?'Bring your folding bike':'Bring your bike'}</span>}
        <span className="mt-3 block text-xs text-white/80">{journey.walkingMeters > 0 && (journey.walkingMeters + ' m walk')}{journey.cyclingMeters > 0 && ((journey.walkingMeters > 0 ? ' · ' : '') + (journey.cyclingMeters/1000).toFixed(1) + ' km cycle')}{journey.transfers > 0 && (' · ' + journey.transfers + (journey.transfers===1?' transfer':' transfers'))}</span>
      </button>
      {result.journeys.length>1 && <button type="button" aria-expanded={showAlternatives} aria-controls="alternative-journeys" onClick={() => setShowAlternatives(!showAlternatives)} className="mb-4 mt-0.5 min-h-12 w-full rounded-b-2xl rounded-t-lg border border-moss/30 bg-fog px-4 text-sm font-bold text-ink">{showAlternatives?'Hide alternatives':('Other journeys (' + (result.journeys.length-1) + ')')}</button>}
      {showAlternatives && <div id="alternative-journeys" className="mt-2 space-y-2">{result.journeys.map((j,i) => i===selected ? null : <button key={j.id} type="button" onClick={() => {setSelected(i);setShowAlternatives(false);}} className="min-h-14 w-full rounded-2xl border border-fog bg-white p-4 text-left"><span className="flex justify-between text-sm font-bold"><span>{i===0?'Recommended':j.legs.every(l=>l.mode==='walk')?'Walk':j.legs.every(l=>l.mode==='cycle')?'Cycle':('Option ' + (i+1))}{j.affected?' · disruption':''}</span><span>{Math.ceil(j.durationSeconds/60)} min</span></span><RouteSummary journey={j}/><span className="mt-2 block"><CrowdBadge level={j.crowdLevel} comparison={j.crowdComparison}/></span><span className="mt-2 block text-xs text-moss">Leave {time(j.startTime)} · arrive {time(j.endTime)}{j.timeDifferenceMinutes!==undefined && (' · '+(j.timeDifferenceMinutes>0?'+':'')+j.timeDifferenceMinutes+' min travel vs original')}</span></button>)}</div>}
      {result.notice && <p className="mb-3 rounded-2xl bg-fog p-3 text-sm">{result.notice}</p>}
      {result.arriveBy && <p className="mb-4 rounded-2xl bg-white p-4 text-sm">{journey.endTime<=Date.parse(result.arriveBy) ? `Leave by ${time(journey.startTime)} · arrive ${Math.floor((Date.parse(result.arriveBy)-journey.endTime)/60000)} min before your event.` : 'This journey arrives after your event starts. Try an earlier departure or another option.'}<span className="mt-1 block text-xs text-moss">Scheduled estimate; allow extra time for delays.</span></p>}
      {result.journeys.some(j=>j.affected) && !journey.affected && <p className="mb-4 rounded-2xl border border-moss bg-white p-4 text-sm">This option avoids the reported affected segment. Follow the connections below.</p>}
    </section>}
    <section className="mt-5" aria-label="Journey map"><LiveMap routeGeoJson={journey?.geojson || EMPTY} journey={journey} comparisonJourney={result?.alerts?.status===2 && result?.comparisonJourney?.affected && result.comparisonJourney.id!==journey?.id?result.comparisonJourney:null} layers={layers}/></section>
    {journey && <div ref={details} className="mt-5 scroll-mt-4"><JourneyDetails journey={journey} stale={stale}/>{(result.warnings || []).length>0 && <details className="mt-3 rounded-2xl border border-fog p-4"><summary className="min-h-11 cursor-pointer text-xs font-bold text-moss">Data availability · {(result.warnings || []).length} notices</summary><ul className="space-y-2 text-xs text-moss">{result.warnings.map(w=><li key={w}>{w}</li>)}</ul></details>}<button type="button" onClick={() => {try {localStorage.removeItem(STORAGE);} catch {} navigator.serviceWorker?.controller?.postMessage({type:'CLEAR_JOURNEYS'});setResult(null);setSavedNotice('');}} className="mt-2 min-h-11 px-2 text-xs text-moss">Clear saved journey</button></div>}
    <footer className="mt-8 text-center text-[11px] text-moss">OneMap · LTA DataMall · OpenStreetMap<br/>Built for the way you move.</footer>
  </main>;
}

function RouteSummary({journey}) {
  const legs = journey.legs.filter(l => l.mode !== 'walk');
  return <span className="mt-3 flex flex-wrap items-center gap-2">{legs.length ? legs.map((l,i) => <span key={l.id} className="inline-flex items-center gap-2">{i>0 && <span aria-hidden="true">→</span>}{l.mode==='cycle' ? <span className="inline-flex items-center gap-1 text-xs"><Bike size={15}/>Cycle</span> : <ServiceBadge leg={l}/>}</span>) : <span className="inline-flex items-center gap-1 text-xs"><Footprints size={15}/>Walk all the way</span>}</span>;
}
