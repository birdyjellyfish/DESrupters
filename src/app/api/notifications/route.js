import { NextResponse } from 'next/server';
import { pushKeys,saveWatch,deleteWatch,monitorActive,allowedNotificationOrigin } from '../../../lib/server/notifications.mjs';
import { point,preferences } from '../../../lib/routing.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET() {const {publicKey}=await pushKeys();return NextResponse.json({publicKey,monitorActive:await monitorActive()},{headers:{'Cache-Control':'no-store'}});}
function originMatches(request) {return allowedNotificationOrigin(request.headers.get('origin'),request.url);}
export async function POST(request) {
  try {
    if(!originMatches(request))return NextResponse.json({error:'Invalid origin'},{status:403});
    const body=await request.json(),c=body.config || {};
    if(!/^\d{2}:\d{2}$/.test(c.routine?.leaveHome) || !/^\d{2}:\d{2}$/.test(c.routine?.leaveWork))throw new Error('Set your commute times first.');
    const timeValid=t=>Number(t.slice(0,2))<24 && Number(t.slice(3))<60;
    if(!timeValid(c.routine.leaveHome)||!timeValid(c.routine.leaveWork))throw new Error('Invalid commute time.');
    const config={home:c.home?point(c.home):null,work:c.work?point(c.work):null,preferences:preferences(c.preferences),routine:{leaveHome:c.routine.leaveHome,leaveWork:c.routine.leaveWork,days:[1,2,3,4,5]},events:(c.events || []).slice(0,20).filter(e=>Number.isFinite(Date.parse(e.start)) && e.place).map(e=>({id:String(e.id).slice(0,80),title:'Calendar event',location:'Calendar location',start:e.start,place:point(e.place)}))};
    if(!config.home || (!config.work && !config.events.length))throw new Error('Set home and work, or a located calendar event, first.');
    const credentials=await saveWatch(body.subscription,config,body.credentials);
    return NextResponse.json({...credentials,monitorActive:await monitorActive()},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return NextResponse.json({error:/Set |Invalid |Unsupported |expired/.test(e.message)?e.message:'Notifications need the local database. Please try again.'},{status:400});}
}
export async function DELETE(request) {
  try {if(!originMatches(request))return NextResponse.json({error:'Invalid origin'},{status:403});const {id,token}=await request.json();await deleteWatch(String(id),String(token));return NextResponse.json({ok:true});}
  catch{return NextResponse.json({error:'Could not remove notification subscription.'},{status:503});}
}
