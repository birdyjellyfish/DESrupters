export default function CrowdBadge({level,comparison,source}) {
  const text={l:'Low',m:'Moderate',h:'High',none:'No transit crowds'}[level] || 'Crowd unknown';
  const count={l:1,m:2,h:3}[level] || 0;
  return <span className="inline-flex flex-wrap items-center gap-2 text-xs"><span aria-hidden="true" className="inline-flex items-end gap-0.5">{[1,2,3].map(n=><span key={n} className="w-1.5 rounded-sm" style={{height:5+n*3,backgroundColor:n<=count?({l:'#69b898',m:'#efbb42',h:'#ee8270'}[level]):'#a0aaa5',opacity:n<=count?1:.35}}/>)}</span><span>{text}{source==='forecast'?' · forecast':''}</span>{comparison && <span>· {comparison==='more'?'More crowded than normal':comparison==='less'?'Less crowded than normal':'Around normal'} (estimate)</span>}</span>;
}
