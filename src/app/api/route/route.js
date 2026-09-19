import { NextResponse } from 'next/server';
import { validatePlan, planJourney } from '../../../lib/server/planner.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request) {
  let input;
  try {input=validatePlan(await request.json());} catch(e) {return NextResponse.json({error:e.message || 'Invalid journey request.'},{status:400});}
  try {return NextResponse.json(await planJourney(input),{headers:{'Cache-Control':'no-store'}});}
  catch(e) {return NextResponse.json({error:e.status===404?e.message:'Unable to plan this journey. Try again shortly.'},{status:e.status || 502});}
}
