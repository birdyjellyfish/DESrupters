import { NextResponse } from 'next/server';
import { spatialOverlay } from '../../../../lib/server/spatial.mjs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const bbox = (request.nextUrl.searchParams.get('bbox') || '').split(',').map(Number);
  const allowed = ['shelter','footpath','crossing','cycling','station','exit','bus_stop','taxi'];
  const layers = (request.nextUrl.searchParams.get('layers') || 'shelter,exit,bus_stop,station,crossing').split(',').filter(l => allowed.includes(l));
  if (bbox.length !== 4 || bbox.some(n => !Number.isFinite(n)) || bbox[0]<103.5 || bbox[2]>104.2 || bbox[1]<1.1 || bbox[3]>1.5 || bbox[0]>=bbox[2] || bbox[1]>=bbox[3] || (bbox[2]-bbox[0])*(bbox[3]-bbox[1])>0.0025) return NextResponse.json({ error: 'Zoom in to see local walking infrastructure.' }, { status: 400 });
  try { return NextResponse.json(await spatialOverlay(bbox,layers), { headers: { 'Cache-Control': 'public, max-age=3600' } }); }
  catch { return NextResponse.json({ error: 'Spatial layers unavailable. Start PostGIS and import the supplied data.' }, { status: 503 }); }
}
