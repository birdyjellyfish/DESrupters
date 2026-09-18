"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Accessibility,
  ArrowRight,
  Bell,
  Bike,
  BusFront,
  CalendarDays,
  Check,
  ChevronDown,
  CloudRain,
  CloudSun,
  Compass,
  Footprints,
  Info,
  MapPin,
  Menu,
  Navigation,
  RefreshCw,
  Route,
  ShieldCheck,
  Signal,
  Sparkles,
  TrainFront,
  TriangleAlert,
  UserRound,
  WifiOff,
  X,
} from "lucide-react";
import LiveMap from "./components/LiveMap";

const personas = {
  rachel: {
    name: "Rachel",
    descriptor: "Fixed-schedule commuter",
    origin: "Tampines",
    destination: "Raffles Place",
    initial: "R",
    color: "#e4a853",
    arrival: "08:45",
    leave: "07:40",
    focus: "Protect my arrival time",
    chips: ["15 min delay matters", "Fewer alerts", "EWL routine"],
  },
  arjun: {
    name: "Arjun",
    descriptor: "Multi-modal, flexible start",
    origin: "Punggol",
    destination: "one-north",
    initial: "A",
    color: "#7fae74",
    arrival: "09:30",
    leave: "08:30",
    focus: "Avoid crowds & rain",
    chips: ["Comfort first", "Bike-friendly", "Sheltered routes"],
  },
  mdm: {
    name: "Mdm Lim",
    descriptor: "Accessibility-constrained traveller",
    origin: "Bedok",
    destination: "Singapore General Hospital",
    initial: "L",
    color: "#8c9cc3",
    arrival: "10:00",
    leave: "08:45",
    focus: "Step-free, sheltered journey",
    chips: ["No stairs", "Lift verified", "Large text"],
  },
};

const routes = {
  normal: {
    headline: "Your usual route is on time",
    summary: "EWL direct · 10 min walk",
    duration: "55 min",
    arrival: "08:35",
    confidence: "High confidence",
    reason: "No active disruption on your routine",
    badge: "Recommended",
  },
  disruption: {
    headline: "Take Bus 10 from Tampines",
    summary: "Bus 10 → Raffles Place · 11 min longer",
    duration: "66 min",
    arrival: "08:46",
    confidence: "Medium confidence",
    reason: "EWL signal fault near Simei · updated 2 min ago",
    badge: "Best for your arrival",
  },
};

function IconButton({ label, children, onClick, active = false }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${
        active
          ? "border-ink bg-ink text-white"
          : "border-[#d6ded4] bg-white/70 text-ink hover:border-moss hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

function Pill({ children, tone = "neutral" }) {
  const styles = {
    neutral: "border-[#d9e2d7] bg-[#f7f7f1] text-moss",
    amber: "border-[#f1d8a9] bg-[#fff8e8] text-[#946b24]",
    green: "border-[#cfe2c9] bg-[#f0f8ed] text-[#3c7046]",
    coral: "border-[#f0c7b9] bg-[#fff1ed] text-[#a74d37]",
  };
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-[0.01em] ${styles[tone]}`}>{children}</span>;
}

function MapCard({ disrupted, onSelectRoute, selectedRoute }) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-[#dce4d9] bg-[#e9ede5] shadow-card" aria-label="Journey map">
      <div className="relative h-[285px] overflow-hidden bg-[#dfe7da]">
        <div className="absolute inset-0 opacity-45" style={{ backgroundImage: "linear-gradient(115deg, transparent 48%, #bdcdbb 49%, transparent 50%), linear-gradient(25deg, transparent 48%, #c6d2c1 49%, transparent 50%)", backgroundSize: "92px 76px" }} />
        <div className="absolute left-[11%] top-[13%] rounded bg-white/70 px-2 py-1 text-[10px] font-bold text-moss">CENTRAL AREA</div>
        <div className="absolute left-[68%] top-[22%] rotate-12 rounded bg-white/70 px-2 py-1 text-[10px] font-bold text-moss">KALLANG</div>
        <div className="absolute left-[9%] top-[68%] rotate-[-12deg] rounded bg-white/70 px-2 py-1 text-[10px] font-bold text-moss">EAST COAST</div>
        <svg viewBox="0 0 400 285" className="absolute inset-0 h-full w-full" role="img" aria-label={disrupted ? "Map showing the original affected rail route and revised bus alternative" : "Map showing the recommended rail route from Tampines to Raffles Place"}>
          <path d="M45 215 C98 189 135 194 180 160 S254 112 338 70" fill="none" stroke="#c9d3c6" strokeWidth="18" strokeLinecap="round" opacity="0.65" />
          <path d="M45 215 C98 189 135 194 180 160 S254 112 338 70" fill="none" stroke="#5c8770" strokeWidth="6" strokeLinecap="round" strokeDasharray={disrupted ? "10 12" : "0"} />
          {disrupted && <path d="M45 215 C108 249 184 239 219 207 S286 149 338 70" fill="none" stroke="#d06b4d" strokeWidth="7" strokeLinecap="round" />}
          <circle cx="45" cy="215" r="10" fill="#fff" stroke="#213d31" strokeWidth="4" />
          <circle cx="338" cy="70" r="10" fill="#fff" stroke="#213d31" strokeWidth="4" />
          {disrupted && <circle cx="180" cy="160" r="13" fill="#fff8e8" stroke="#d06b4d" strokeWidth="4" />}
          <circle cx="45" cy="215" r="4" fill="#213d31" />
          <circle cx="338" cy="70" r="4" fill="#213d31" />
        </svg>
        <div className="absolute bottom-3 left-3 rounded-xl bg-white/90 px-3 py-2 text-xs font-bold text-ink shadow-sm">
          <span className="inline-block h-2 w-2 rounded-full bg-[#5c8770]" /> Tampines
        </div>
        <div className="absolute right-3 top-3 rounded-xl bg-white/90 px-3 py-2 text-xs font-bold text-ink shadow-sm">Raffles Place</div>
        {disrupted && <div className="absolute left-[39%] top-[42%] rounded-xl border border-[#e9b39f] bg-[#fff6f2] px-2 py-1 text-[10px] font-bold text-[#a74d37] shadow-sm">Affected EWL</div>}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-xl bg-white/85 px-2.5 py-1.5 text-[10px] font-bold text-moss shadow-sm"><MapPin size={12} /> OSM base</div>
      </div>
      <div className="border-t border-white/80 bg-[#f8f9f4] p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-moss">Compare routes</p>
          <p className="text-[10px] font-semibold text-moss">Tap a route to inspect</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onSelectRoute("recommended")} className={`rounded-2xl border p-3 text-left transition ${selectedRoute === "recommended" ? "border-ink bg-white shadow-sm" : "border-transparent bg-[#edf2ea]"}`}>
            <div className="mb-2 flex items-center justify-between"><span className="h-2.5 w-2.5 rounded-full bg-[#5c8770]" /><span className="text-xs font-extrabold text-ink">{disrupted ? "Bus 10" : "EWL direct"}</span></div>
            <p className="text-[11px] text-moss">{disrupted ? "66 min · +11 min" : "55 min · on time"}</p>
          </button>
          <button onClick={() => onSelectRoute("original")} className={`rounded-2xl border p-3 text-left transition ${selectedRoute === "original" ? "border-[#d06b4d] bg-[#fff7f3] shadow-sm" : "border-transparent bg-[#edf2ea]"}`}>
            <div className="mb-2 flex items-center justify-between"><span className={`h-2.5 w-2.5 rounded-full ${disrupted ? "bg-[#d06b4d]" : "bg-[#9aa99d]"}`} /><span className="text-xs font-extrabold text-ink">{disrupted ? "Usual EWL" : "Bus 10"}</span></div>
            <p className="text-[11px] text-moss">{disrupted ? "Paused · signal fault" : "64 min · 1 transfer"}</p>
          </button>
        </div>
        <p className="mt-3 text-[10px] text-moss">© OpenStreetMap contributors · Route geometry shown for demo purposes</p>
      </div>
    </section>
  );
}

function Step({ icon: Icon, title, detail, time, active = false, warning = false }) {
  return (
    <div className="relative flex gap-3">
      <div className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${warning ? "bg-[#fff0eb] text-coral" : active ? "bg-ink text-white" : "bg-[#e7eee4] text-moss"}`}><Icon size={17} strokeWidth={2.2} /></div>
      <div className="min-w-0 flex-1 pb-4">
        <div className="flex items-baseline justify-between gap-3"><p className="text-sm font-extrabold text-ink">{title}</p><span className="shrink-0 text-xs font-bold text-moss">{time}</span></div>
        <p className={`mt-1 text-xs leading-5 ${warning ? "font-semibold text-[#a74d37]" : "text-moss"}`}>{detail}</p>
      </div>
    </div>
  );
}

function PersonaCard({ persona, selected, onClick }) {
  return (
    <button onClick={onClick} className={`w-full rounded-2xl border p-4 text-left transition ${selected ? "border-ink bg-white shadow-sm" : "border-[#dce5da] bg-[#f7f8f3]"}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black text-ink" style={{ backgroundColor: persona.color }}>{persona.initial}</span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-ink">{persona.name}</span><span className="mt-0.5 block text-xs text-moss">{persona.descriptor}</span></span>
        {selected && <Check size={18} className="text-moss" />}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">{persona.chips.map((chip) => <Pill key={chip}>{chip}</Pill>)}</div>
    </button>
  );
}

export default function Home() {
  const [personaId, setPersonaId] = useState("rachel");
  const [demoDisruption, setDemoDisruption] = useState(false);
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState("today");
  const [selectedRoute, setSelectedRoute] = useState("recommended");
  const [showPersonas, setShowPersonas] = useState(false);
  const [showPlanner, setShowPlanner] = useState(false);
  const [toast, setToast] = useState("");
  const [liveData, setLiveData] = useState(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState("");
  const [routeResult, setRouteResult] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const persona = personas[personaId];
  const liveDisruption = liveData?.alerts?.status === 2;
  const disrupted = demoDisruption || liveDisruption;
  const liveSegment = liveData?.alerts?.segments?.[0];
  const liveMessage = liveData?.alerts?.messages?.[0]?.content;
  const crowd = liveData?.crowd;
  const weather = liveData?.weather;
  const advisoryCount = liveData?.alerts?.messages?.length || 0;
  const feedLabel = liveLoading ? "Checking feeds" : liveData?.source === "lta" ? "LTA live" : liveData?.source === "mixed" ? "LTA partial" : "Demo feed";
  const route = disrupted
    ? { ...routes.disruption, reason: liveDisruption ? (liveMessage || `${liveSegment?.line || "Train"} service disruption · live alert`) : routes.disruption.reason }
    : routes.normal;
  const displayedRoute = routeResult && !disrupted
    ? {
        ...route,
        headline: `${routeResult.modeLabel.replace("Valhalla ", "")} ready`,
        summary: `${routeResult.modeLabel} · ${routeResult.summary.distanceKm.toFixed(1)} km`,
        duration: `${routeResult.summary.durationMinutes} min`,
        badge: "Valhalla route",
        confidence: "OSM graph",
        reason: "Preference-aware route · live OSM geometry",
      }
    : route;

  useEffect(() => {
    setOrigin(persona.origin);
    setDestination(persona.destination);
  }, [persona.origin, persona.destination]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  const refreshTransit = useCallback(async (showToast = false) => {
    setLiveLoading(true);
    try {
      const response = await fetch("/api/transit/overview", { cache: "no-store" });
      if (!response.ok) throw new Error(`Transit feed returned ${response.status}`);
      const payload = await response.json();
      setLiveData(payload);
      setLiveError(payload.warning || "");
      if (showToast) setToast(payload.source === "lta" ? "LTA live feeds refreshed" : "Live feed unavailable · demo fixture retained");
    } catch (error) {
      setLiveError(error.message || "Unable to reach the transit feed");
      if (showToast) setToast("Could not refresh live feeds · showing cached data");
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshTransit();
  }, [refreshTransit]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  const decisionCopy = useMemo(() => {
    if (personaId === "arjun") return disrupted ? "Skip the EWL crush. A sheltered bus + MRT mix is more predictable today." : liveData?.forecast?.level === "h" ? "The crowd forecast is high near your commute. Leave 20 min later and take the sheltered bus mix." : "Good conditions for your bike-to-LRT start. Crowd levels look comfortable.";
    if (personaId === "mdm") return "No lift outages on this route. Your exit and both walking legs are step-free.";
    if (liveData?.forecast?.level === "h" && !disrupted) return "Crowd forecast is high at Tampines near your departure. Leave 10 min earlier to protect your buffer.";
    return disrupted ? "Leave now for Bus 10. It keeps you closest to your 08:45 meeting." : "No need to check in. I’ll alert you only if your buffer drops below 15 min.";
  }, [personaId, disrupted, liveData]);

  const changePersona = (id) => {
    setPersonaId(id);
    setDemoDisruption(false);
    setSelectedRoute("recommended");
    setRouteResult(null);
    setRouteError("");
    setShowPersonas(false);
    setToast(`Now planning for ${personas[id].name}`);
  };

  const runDisruption = () => {
    setDemoDisruption((current) => !current);
    setSelectedRoute("recommended");
    setToast(disrupted ? "Live demo reset · usual route restored" : "Demo disruption injected · recommendation updated");
  };

  const planRoute = async () => {
    if (!origin.trim() || !destination.trim()) {
      setToast("Enter both locations first");
      return;
    }
    setShowPlanner(false);
    setTab("today");
    setRouteLoading(true);
    setRouteError("");
    try {
      const search = async (query) => {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok || !payload.results?.[0]) throw new Error(payload.error || `Could not find ${query}`);
        return payload.results[0];
      };
      const [originPlace, destinationPlace] = await Promise.all([search(origin), search(destination)]);
      const preferences = personaId === "arjun"
        ? { mode: "bicycle", preferSheltered: true, avoidHills: true }
        : personaId === "mdm"
          ? { mode: "pedestrian", slowWalking: true, preferSheltered: true, avoidHills: true }
          : { mode: "pedestrian", preferSheltered: true };
      const response = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: originPlace, destination: destinationPlace, mode: preferences.mode, preferences }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Valhalla could not calculate this route");
      setRouteResult(payload);
      setToast(`${payload.modeLabel} ready · ${payload.summary.durationMinutes} min`);
    } catch (error) {
      setRouteError(error.message || "Unable to calculate route");
      setToast(error.message?.includes("Valhalla") ? "Start Valhalla to calculate a live route" : "Location search failed");
    } finally {
      setRouteLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-cream text-ink selection:bg-leaf/40">
      <div className="mx-auto min-h-screen max-w-[470px] bg-cream pb-24">
        <header className="sticky top-0 z-30 border-b border-[#dfe7dc]/90 bg-cream/95 px-5 pb-3 pt-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <button className="flex items-center gap-2" onClick={() => setTab("today")} aria-label="Go to Wayfinder home"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-leaf"><Compass size={21} strokeWidth={2.5} /></span><span className="font-display text-[21px] font-bold tracking-[-0.03em]">wayfinder</span></button>
            <div className="flex items-center gap-2"><IconButton label="Open alerts" onClick={() => setToast(disrupted ? "1 active route alert" : advisoryCount ? `${advisoryCount} LTA ${advisoryCount === 1 ? "advisory" : "advisories"} available` : "No new alerts")}>{disrupted || advisoryCount > 0 ? <Bell size={19} className="text-coral" /> : <Bell size={19} />}</IconButton><button onClick={() => setShowPersonas(true)} className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-[#e4a853] text-sm font-black text-ink shadow-sm" aria-label={`Current profile: ${persona.name}`}>{persona.initial}</button></div>
          </div>
          {offline && <div className="mt-3 flex items-center justify-between rounded-xl border border-[#e9d19a] bg-[#fff8e8] px-3 py-2 text-xs font-bold text-[#946b24]"><span className="flex items-center gap-2"><WifiOff size={15} /> Offline mode · journey cached</span><button onClick={() => setOffline(false)} className="rounded-full p-1" aria-label="Dismiss offline mode"><X size={15} /></button></div>}
        </header>

        <div className="px-5 pt-5">
          {tab === "today" && <>
            <section className="mb-5 flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-moss">Tuesday · 18 Sep</p><h1 className="mt-1 font-display text-[32px] leading-tight tracking-[-0.04em]">Good morning, {persona.name}</h1></div><div className={`mt-1 flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-extrabold ${feedLabel === "LTA live" ? "bg-[#e8f2e4] text-[#3d7047]" : "bg-[#fff8e8] text-[#946b24]"}`}><span className={`h-1.5 w-1.5 rounded-full ${feedLabel === "LTA live" ? "bg-[#5c9b5c]" : "bg-amber"}`} /> {feedLabel}</div></section>
            <section className={`mb-5 rounded-[25px] border p-4 shadow-card ${disrupted ? "border-[#efc6b8] bg-[#fff7f3]" : "border-[#d8e5d4] bg-[#edf5e9]"}`}>
              <div className="flex items-start gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${disrupted ? "bg-[#ffe7df] text-coral" : "bg-white text-moss"}`}>{disrupted ? <TriangleAlert size={20} /> : <Sparkles size={20} />}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="text-[11px] font-black uppercase tracking-[0.14em] text-moss">Your commute brief</p><span className="text-[10px] font-bold text-moss">07:30</span></div><p className="mt-1 text-[15px] font-extrabold leading-6 text-ink">{decisionCopy}</p></div></div>
              <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-3"><span className="flex items-center gap-1.5 text-xs font-semibold text-moss"><CloudRain size={14} /> {weather?.label || "Rain unlikely"} · 28°C</span><button onClick={() => setShowPlanner(true)} className="text-xs font-black text-ink underline decoration-leaf decoration-2 underline-offset-4">Edit trip</button></div>
            </section>

            <div className="mb-2 flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-moss">Next journey</p><p className="mt-1 text-sm font-semibold text-moss">Arrive by <strong className="text-ink">{persona.arrival}</strong> · leave at {persona.leave}</p></div><button onClick={() => setOffline((v) => !v)} className="flex min-h-10 items-center gap-1.5 rounded-full border border-[#d9e2d7] bg-white/60 px-3 text-xs font-bold text-moss"><Signal size={14} /> {offline ? "Go online" : "Offline test"}</button></div>
            <section className={`mb-4 rounded-[25px] border bg-white p-4 shadow-card ${disrupted ? "border-[#efc6b8]" : "border-[#dce4d9]"}`}>
              <div className="mb-4 flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><Pill tone={disrupted ? "coral" : "green"}>{displayedRoute.badge}</Pill>{disrupted && <Pill tone="amber">+11 min</Pill>}</div><h2 className="mt-2 text-[21px] font-black tracking-[-0.02em]">{displayedRoute.headline}</h2><p className="mt-1 text-sm text-moss">{displayedRoute.summary}</p></div><div className="text-right"><p className="text-[27px] font-black tracking-[-0.04em]">{displayedRoute.arrival}</p><p className="text-[11px] font-bold text-moss">arrival · {displayedRoute.duration}</p></div></div>
              <div className="flex items-center justify-between rounded-2xl bg-[#f5f7f2] px-3 py-3 text-xs"><span className="flex items-center gap-2 font-bold text-moss"><span className={`h-2.5 w-2.5 rounded-full ${disrupted ? "bg-coral" : "bg-[#5c8770]"}`} /> {displayedRoute.reason}</span><span className="font-black text-ink">{displayedRoute.confidence}</span></div>
            </section>
            {process.env.NEXT_PUBLIC_MAP_STYLE_URL ? <LiveMap routeGeoJson={routeResult?.geojson} disrupted={disrupted} /> : <MapCard disrupted={disrupted} onSelectRoute={setSelectedRoute} selectedRoute={selectedRoute} />}
            {routeError && <p className="mt-3 rounded-2xl border border-[#f0c7b9] bg-[#fff7f3] px-3 py-2 text-xs font-semibold text-[#a74d37]">{routeError}</p>}

            {disrupted && <section className="mt-4 rounded-[25px] border border-[#efc6b8] bg-[#fff7f3] p-4"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ffe5dd] text-coral"><RefreshCw size={17} /></div><div><p className="text-sm font-black text-ink">Why your route changed</p><p className="mt-1 text-xs leading-5 text-[#8e4938]">{liveDisruption ? <><strong>LTA TrainServiceAlerts</strong> reports {liveSegment?.line || "a train service"} disruption{liveSegment?.direction ? ` ${liveSegment.direction.toLowerCase()}` : ""}. Wayfinder recommends Bus 10 and shows the trade-off instead of sending everyone to a shuttle.</> : <>An injected <strong>Status 2</strong> EWL signal fault affects the usual path. Wayfinder distributes the detour via Bus 10 to protect your arrival buffer instead of sending everyone to a shuttle.</>}</p></div></div></section>}

            <section className="mt-5 rounded-[25px] border border-[#dce4d9] bg-white p-4 shadow-card"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-moss">Door to door</p><h2 className="mt-1 text-lg font-black">Follow your route</h2></div><Pill tone={disrupted ? "coral" : "green"}>{offline ? "Cached" : routeResult && !disrupted ? "Live route" : "Live plan"}</Pill></div>{routeResult && !disrupted ? <div className="space-y-3"><div className="grid grid-cols-2 gap-2"><div className="rounded-2xl bg-[#edf5e9] p-3"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-moss">Distance</p><p className="mt-1 text-xl font-black">{routeResult.summary.distanceKm.toFixed(1)} km</p></div><div className="rounded-2xl bg-[#edf5e9] p-3"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-moss">Travel time</p><p className="mt-1 text-xl font-black">{routeResult.summary.durationMinutes} min</p></div></div><div className="rounded-2xl bg-[#f5f7f2] p-3"><p className="text-xs font-black text-ink">Key directions</p><ol className="mt-2 space-y-2">{routeResult.maneuvers.slice(0, 3).map((maneuver, index) => <li key={`${maneuver.instruction}-${index}`} className="flex gap-2 text-xs leading-5 text-moss"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-black text-ink">{index + 1}</span><span>{maneuver.instruction}</span></li>)}</ol></div></div> : <div className="relative"><div className="absolute bottom-5 left-[18px] top-5 w-px bg-[#d8e3d5]" />{disrupted ? <><Step icon={Footprints} title={`Walk to ${origin} interchange`} detail="Sheltered path · 6 min · follow Exit B" time="07:40" active /><Step icon={BusFront} title="Bus 10 to Marina Centre" detail="Board at Tampines Int · next bus 4 min" time="07:51" active /><Step icon={Footprints} title="Walk to Raffles Place" detail="Covered walkway · 8 min · Exit 4" time="08:37" /></> : <><Step icon={Footprints} title={`Walk to ${origin} station`} detail="Sheltered path · 6 min · follow Exit B" time="07:40" active /><Step icon={TrainFront} title="East–West Line to Raffles Place" detail="Board car 3 · alight at Exit 4" time="07:50" active /><Step icon={Footprints} title="Walk to your desk" detail="Covered walkway · 10 min · no stairs" time="08:25" /></>}</div>}<button onClick={() => setToast(offline ? "Using the last cached journey payload" : "Navigation handoff is ready")} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-sm font-black text-white transition hover:bg-moss"><Navigation size={17} /> Start navigation <ArrowRight size={16} /></button></section>

            <section className="mt-4"><div className="flex items-center gap-2 overflow-x-auto"><Pill tone={(crowd?.level || (disrupted ? "h" : "l")) === "h" ? "coral" : (crowd?.level || "l") === "m" ? "amber" : "green"}><TrainFront size={13} className="mr-1 inline" /> {crowd?.station || "EWL"} · {crowd?.label || (disrupted ? "High" : "Low")} {crowd?.label && <span className="font-normal">· forecast {liveData?.forecast?.label || "-"}</span>}</Pill><Pill tone={weather?.label && /rain|shower|thunder/i.test(weather.label) ? "amber" : "green"}><CloudSun size={13} className="mr-1 inline" /> {weather?.label || "Weather clear"}</Pill><button onClick={() => refreshTransit(true)} className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#dce4d9] bg-white text-moss" aria-label="Refresh live feeds"><RefreshCw size={14} /></button></div>{liveError && <p className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-[#946b24]"><Info size={12} /> {liveError}</p>}</section>
          </>}

          {tab === "plan" && <section><div className="mb-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-moss">Plan ahead</p><h1 className="mt-1 font-display text-[32px] leading-tight tracking-[-0.04em]">Where are you going?</h1><p className="mt-2 text-sm leading-5 text-moss">Enter any Singapore locations for a preference-aware walking or cycling route.</p></div><div className="space-y-3 rounded-[25px] border border-[#dce4d9] bg-white p-4 shadow-card"><label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-moss">From</span><div className="flex items-center gap-3 rounded-2xl bg-[#f5f7f2] px-3"><MapPin size={17} className="text-moss" /><input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="e.g. Tampines Ave 5" className="h-12 w-full bg-transparent text-sm font-bold outline-none" /></div></label><div className="ml-5 h-3 border-l border-dashed border-[#b8c9b5]" /><label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-moss">To</span><div className="flex items-center gap-3 rounded-2xl bg-[#f5f7f2] px-3"><Navigation size={17} className="text-moss" /><input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Raffles Place MRT" className="h-12 w-full bg-transparent text-sm font-bold outline-none" /></div></label><label className="block pt-1"><span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-moss">Arrive by</span><div className="flex items-center gap-3 rounded-2xl bg-[#f5f7f2] px-3"><CalendarDays size={17} className="text-moss" /><select className="h-12 w-full appearance-none bg-transparent text-sm font-bold outline-none"><option>{persona.arrival}</option><option>09:00</option><option>09:30</option><option>10:00</option></select><ChevronDown size={16} className="text-moss" /></div></label><button onClick={planRoute} disabled={routeLoading} className="mt-2 flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-sm font-black text-white disabled:cursor-wait disabled:opacity-70">{routeLoading ? <RefreshCw size={18} className="animate-spin" /> : <Route size={18} />} {routeLoading ? "Finding route…" : "Find live route"}</button>{routeError && <p className="text-xs font-semibold text-[#a74d37]">{routeError}</p>}</div><div className="mt-4 rounded-2xl border border-[#dce4d9] bg-[#edf5e9] p-4"><p className="flex items-center gap-2 text-sm font-black"><Sparkles size={16} className="text-moss" /> Personalised for {persona.name}</p><p className="mt-1 text-xs leading-5 text-moss">{persona.focus}. Routing uses OneMap search and the local Valhalla OSM graph.</p></div></section>}

          {tab === "profile" && <section><div className="mb-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-moss">Your commuter lens</p><h1 className="mt-1 font-display text-[32px] leading-tight tracking-[-0.04em]">Built around you</h1><p className="mt-2 text-sm leading-5 text-moss">Choose a persona to see how the same network conditions become a different decision.</p></div><div className="space-y-3">{Object.entries(personas).map(([id, value]) => <PersonaCard key={id} persona={value} selected={personaId === id} onClick={() => changePersona(id)} />)}</div><div className="mt-5 rounded-[25px] border border-[#dce4d9] bg-white p-4 shadow-card"><p className="text-xs font-black uppercase tracking-[0.14em] text-moss">Current decision rule</p><p className="mt-2 text-lg font-black">{persona.focus}</p><div className="mt-4 space-y-2 text-xs text-moss"><p className="flex gap-2"><Check size={15} className="shrink-0 text-moss" /> Preferences rank alternatives, not just shortest time.</p><p className="flex gap-2"><Check size={15} className="shrink-0 text-moss" /> Disruptions are shown with a reason and a trade-off.</p><p className="flex gap-2"><Check size={15} className="shrink-0 text-moss" /> Active journeys remain readable when offline.</p></div></div></section>}
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-20 mx-auto max-w-[470px] border-t border-[#dce4d9] bg-cream/95 px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur"><nav className="grid grid-cols-3 gap-2" aria-label="Primary navigation"><button onClick={() => setTab("today")} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-black ${tab === "today" ? "bg-ink text-white" : "text-moss"}`}><Navigation size={18} /> Today</button><button onClick={() => setTab("plan")} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-black ${tab === "plan" ? "bg-ink text-white" : "text-moss"}`}><Route size={18} /> Plan</button><button onClick={() => setTab("profile")} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-black ${tab === "profile" ? "bg-ink text-white" : "text-moss"}`}><UserRound size={18} /> Profile</button></nav></div>

        <button onClick={runDisruption} className="fixed bottom-[92px] right-4 z-20 flex items-center gap-2 rounded-full border border-[#d6ded4] bg-white px-3 py-2.5 text-[10px] font-black text-moss shadow-soft" aria-label="Toggle demo disruption"><TriangleAlert size={14} className={disrupted ? "text-coral" : "text-amber"} /> {disrupted ? "Reset demo" : "Test disruption"}</button>
        {showPersonas && <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/30 p-3" onClick={() => setShowPersonas(false)}><section className="w-full max-w-[450px] rounded-[28px] bg-cream p-5 shadow-soft" onClick={(e) => e.stopPropagation()}><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-moss">Switch commuter</p><h2 className="mt-1 text-xl font-black">Who are we planning for?</h2></div><IconButton label="Close profile switcher" onClick={() => setShowPersonas(false)}><X size={18} /></IconButton></div><div className="space-y-2">{Object.entries(personas).map(([id, value]) => <PersonaCard key={id} persona={value} selected={personaId === id} onClick={() => changePersona(id)} />)}</div></section></div>}
        {showPlanner && <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/30 p-3" onClick={() => setShowPlanner(false)}><section className="w-full max-w-[450px] rounded-[28px] bg-cream p-5 shadow-soft" onClick={(e) => e.stopPropagation()}><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-moss">Quick edit</p><h2 className="mt-1 text-xl font-black">Update this journey</h2></div><IconButton label="Close journey editor" onClick={() => setShowPlanner(false)}><X size={18} /></IconButton></div><div className="space-y-3"><div><label className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-moss" htmlFor="quick-origin">From</label><input id="quick-origin" value={origin} onChange={(e) => setOrigin(e.target.value)} className="h-12 w-full rounded-2xl border-0 bg-white px-4 text-sm font-bold outline-none ring-1 ring-[#dce4d9] focus:ring-2 focus:ring-moss" /></div><div><label className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-moss" htmlFor="quick-destination">To</label><input id="quick-destination" value={destination} onChange={(e) => setDestination(e.target.value)} className="h-12 w-full rounded-2xl border-0 bg-white px-4 text-sm font-bold outline-none ring-1 ring-[#dce4d9] focus:ring-2 focus:ring-moss" /></div><button onClick={planRoute} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-sm font-black text-white">Update journey <ArrowRight size={17} /></button></div></section></div>}
        {toast && <div role="status" className="fixed left-1/2 top-5 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-4 py-3 text-xs font-bold text-white shadow-soft"><Info size={14} className="text-leaf" /> {toast}</div>}
      </div>
    </main>
  );
}
