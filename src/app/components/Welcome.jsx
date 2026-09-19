"use client";
import { useEffect, useState } from 'react';
import { CloudSun, TrainFront } from 'lucide-react';
export default function Welcome({profile,origin,journey,alerts,online,stale,now,weather,demo}) {
  const [overview,setOverview] = useState(null), [hour,setHour] = useState(null);
  useEffect(() => {setHour(Number(new Intl.DateTimeFormat('en-SG',{timeZone:'Asia/Singapore',hour:'numeric',hourCycle:'h23'}).format(now)));},[now]);
  useEffect(() => {
    if(!online) return;
    const controller = new AbortController();
    const refresh = async () => {try {const r = await fetch('/api/transit/overview',{signal:controller.signal});if(r.ok) setOverview(await r.json());} catch {}};
    refresh(); const timer = setInterval(refresh,60000);
    return () => {clearInterval(timer);controller.abort();};
  },[online]);
  const area = overview?.weather?.areas?.slice().sort((a,b) => {
    const distance = x => !origin ? (x.area === 'City' ? 0 : 1) : (x.location?.latitude-origin.lat)**2 + (x.location?.longitude-origin.lon)**2;
    return distance(a)-distance(b);
  })[0];
  const weatherFresh = online && Date.parse(overview?.weather?.validUntil)>now;
  const feed = alerts || overview?.alerts;
  const feedFresh = online && Date.parse(feed?.observedAt)>now-120000;
  const message = !feedFresh || feed?.status == null || (journey && stale) ? 'Disruption updates unavailable' : journey ? (journey.affected ? 'Disruption on your route' : 'No reported disruption on your route') : feed.status === 2 ? 'Rail disruptions reported' : 'No reported rail disruptions';
  return <section aria-label="Welcome" className="mb-5">
    <h1 className="font-display text-[32px] leading-tight">{hour == null ? 'Hello' : hour<12 ? 'Good morning' : hour<18 ? 'Good afternoon' : 'Good evening'}{profile === 'arjun' ? ', Arjun' : ''}.</h1>
    <div className="mt-4 space-y-2 text-xs text-moss"><p className="flex items-center gap-2"><CloudSun size={17}/>{weather?.source==='demo'?`Demo · ${weather.forecast}`:weatherFresh && area ? `${area.forecast} · ${area.area}` : 'Weather unavailable'}</p><p className={`flex items-center gap-2 ${journey?.affected ? 'font-bold text-red-800' : ''}`}><TrainFront size={17}/>{demo?.disruption?'Demo · Punggol LRT disrupted':message}</p></div>
  </section>;
}
