import { NextResponse } from 'next/server';
import { enrichJourneys,normalizeAlerts } from '../../../../lib/server/lta.mjs';
import { demoOptions,demoDisruption } from '../../../../lib/demo.mjs';
import { lineCode } from '../../../../lib/routing.mjs';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  let journeys,demo;
  try {
    const body = await request.json();
    demo=demoOptions(body.demo);
    if (!Array.isArray(body.journeys) || body.journeys.length>6) throw new Error();
    journeys = body.journeys.map(j => {
      if (!Array.isArray(j.legs) || j.legs.length>24) throw new Error();
      const stop = s => ({code:String(s?.code || '').slice(0,15)});
      return {id:String(j.id).slice(0,40),legs:j.legs.map(l => {
        if (!['walk','cycle','bus','rail','other'].includes(l.mode) || !Array.isArray(l.stops) || l.stops.length>100) throw new Error();
        return {id:String(l.id).slice(0,40),mode:l.mode,line:lineCode(l.line || ''),lineName:String(l.lineName || '').slice(0,80),service:String(l.service || '').slice(0,12),from:stop(l.from),to:stop(l.to),stops:l.stops.map(stop),startTime:Number(l.startTime),endTime:Number(l.endTime),alerts:[]};
      })};
    });
  } catch {return NextResponse.json({error:'Invalid journey refresh request.'},{status:400});}
  const alerts = await enrichJourneys(journeys,Date.now(),{alerts:demo.disruption?{...normalizeAlerts(demoDisruption()),observedAt:new Date().toISOString(),source:'demo'}:null});
  return NextResponse.json({journeys,alerts,updatedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
}
