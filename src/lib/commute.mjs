export const DEFAULT_ROUTINE={leaveHome:'08:00',leaveWork:'18:00',days:[1,2,3,4,5]};
export function samePlace(a,b) {return Boolean(a && b && Math.abs(a.lat-b.lat)<.001 && Math.abs(a.lon-b.lon)<.001);}
export function commuteIntent({home,work,events=[],routine=DEFAULT_ROUTINE},now=Date.now()) {
  const local=new Date(now+8*3600000),hour=local.getUTCHours(),date=local.toISOString().slice(0,10);
  const next=events.filter(e=>e.location && Date.parse(e.start)>now && new Date(Date.parse(e.start)+8*3600000).toISOString().slice(0,10)===date && ![home,work].filter(Boolean).some(p=>samePlace(p,e.place) || p.label?.toLowerCase()===e.location.toLowerCase())).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start))[0];
  const away=next && ![home,work].filter(Boolean).some(p=>samePlace(p,next.place) || p.label?.toLowerCase()===next.location.toLowerCase());
  if(away) return {kind:'calendar',event:next,origin:hour>=12?work || home:home || work,destination:next.place || null,label:`Next: ${next.title}`,seed:next.location};
  if(!home || !work) return null;
  const returning=hour>=Math.max(12,Number(routine.leaveWork.split(':')[0])-2);
  return {kind:returning?'home':'work',origin:returning?work:home,destination:returning?home:work,label:returning?'Head home':'Head to work'};
}
export function journeySignature(journey) {return journey?.legs?.filter(l=>l.mode!=='walk').map(l=>`${l.mode}:${l.service || ''}:${l.from?.code || ''}:${l.to?.code || ''}`).join('|') || 'walk';}
export function detourAdvice(current,next) {
  if(!current || !next?.journeys?.[0]) return null;
  const candidate=next.journeys[0],same=[...next.journeys,next.comparisonJourney].filter(Boolean).find(j=>journeySignature(j)===journeySignature(current));
  const intersects=next.alerts?.status===2 && current.legs.some(l=>l.mode==='rail' && next.alerts.segments?.some(s=>s.line===l.line && (!s.stations?.length || [l.from,...(l.stops || []),l.to].some(stop=>s.stations.includes(stop?.code)))));
  const affected=same?.affected || intersects || current.affected;
  const wet=next.weather?.wet && current.legs.some(l=>l.mode==='cycle');
  const crowded=same?.crowdLevel==='h' || same?.crowdComparison==='more';
  const different=journeySignature(candidate)!==journeySignature(current) || candidate.departureOffsetMinutes>0;
  if(!different || candidate.affected || !(affected || wet || crowded)) return null;
  const modes=candidate.legs.filter(l=>l.mode!=='walk').map(l=>l.mode==='cycle'?'cycle':l.service || l.lineName).join(' → ') || 'walk';
  const reason=wet?'Rain on your route':affected?'Disruption on your route':'A quieter way';
  return {title:reason,body:`${candidate.departureOffsetMinutes?`Leave ${candidate.departureOffsetMinutes} min later: `:''}${modes} · ${Math.ceil(candidate.durationSeconds/60)} min`,key:`${reason}:${journeySignature(candidate)}:${candidate.departureOffsetMinutes || 0}`,journey:candidate};
}
