import { NextResponse } from 'next/server';
import { searchPlaces } from '../../../lib/server/onemap.mjs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const query = request.nextUrl.searchParams.get('q')?.trim();
  if (!query || query.length < 2 || query.length > 150) return NextResponse.json({ error: 'Enter 2–150 characters.' }, { status: 400 });
  try { return NextResponse.json({ results: await searchPlaces(query) }, { headers: { 'Cache-Control': 'private, max-age=300' } }); }
  catch (error) { return NextResponse.json({ error: error.message || 'Search unavailable. Try again.' }, { status: 502 }); }
}
