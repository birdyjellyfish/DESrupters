import { lineCode } from '../../lib/routing.mjs';
const COLORS = { EWL: ['#009645','#fff'], NSL: ['#d42e12','#fff'], NEL: ['#9900aa','#fff'], CCL: ['#fa9e0d','#12221c'], DTL: ['#005ec4','#fff'], TEL: ['#9d5b25','#fff'], BPL: ['#637a3c','#fff'], STL: ['#637a3c','#fff'], PTL: ['#637a3c','#fff'] };
export default function ServiceBadge({ leg }) {
  const canonical = leg.line || lineCode(leg.service || leg.from?.code);
  const [backgroundColor,color] = leg.mode === 'bus' ? ['#174e40','#fff'] : COLORS[canonical] || ['#334155','#fff'];
  return <span className="inline-flex shrink-0 rounded-md px-2 py-0.5 text-xs font-bold" style={{backgroundColor,color}} aria-label={`${leg.mode === 'bus' ? 'Bus' : leg.lineName || 'MRT'} ${leg.service || canonical || ''}`}>{leg.service || canonical || leg.lineName}</span>;
}
