import { NextResponse } from 'next/server';
import { serviceAlerts } from '../../../../lib/server/lta.mjs';
import { weatherForecast } from '../../../../lib/server/weather.mjs';
export const dynamic = 'force-dynamic';
export async function GET() {
  const [alerts,weather] = await Promise.all([serviceAlerts(),weatherForecast()]);
  return NextResponse.json({alerts,weather}, { headers: { 'Cache-Control': 'no-store' } });
}
