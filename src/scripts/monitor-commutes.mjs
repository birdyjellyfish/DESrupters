import { initWatches,sendPush } from '../lib/server/notifications.mjs';
import { pool } from '../lib/server/spatial.mjs';
import { planJourney,validatePlan } from '../lib/server/planner.mjs';
import { detourAdvice,commuteIntent } from '../lib/commute.mjs';
import { mkdir,writeFile } from 'node:fs/promises';
import { withMonitorLock } from '../lib/server/monitor-lock.mjs';
let running=false;
async function tick() {
  if(running)return;running=true;
  try {
    await initWatches();
    await mkdir('.local',{recursive:true});await writeFile('.local/monitor-status.json',JSON.stringify({checkedAt:new Date().toISOString()}));
    await withMonitorLock(pool,async client=>{
    const {rows}=await client.query("SELECT * FROM commute_watches WHERE updated_at>now()-interval '30 days'");
    for(const watch of rows) {
      const now=Date.now(),local=new Date(now+8*3600000),config=watch.config;
      const intent=commuteIntent({...config,events:config.events.map(e=>({...e,location:e.place.label}))},now);
      if(!intent?.origin || !intent.destination)continue;
      const routine=config.routine,time=intent.kind==='home'?routine.leaveWork:routine.leaveHome;
      const target=intent.kind==='calendar'?Date.parse(intent.event.start)-3600000:Date.parse(`${local.toISOString().slice(0,10)}T${time}:00+08:00`);
      if(intent.kind!=='calendar' && !routine.days.includes(local.getUTCDay()))continue;
      if(now<target-3600000 || now>target+3600000)continue;
      try {
        const result=await planJourney(validatePlan({origin:intent.origin,destination:intent.destination,preferences:config.preferences,departure:new Date(Math.max(now,target)).toISOString(),arriveBy:intent.event?.start}));
        const day=`${local.toISOString().slice(0,10)}:${intent.kind}:${intent.event?.id || ''}`;
        const current=watch.last_day===day?watch.last_journey:result.comparisonJourney;
        const advice=detourAdvice(current,result);
        if(advice && `${day}:${advice.key}`!==watch.last_advice) {
          await sendPush(watch.subscription,advice);
          await client.query('UPDATE commute_watches SET last_advice=$2 WHERE id=$1',[watch.id,`${day}:${advice.key}`]);
        }
        await client.query('UPDATE commute_watches SET last_day=$2,last_journey=$3 WHERE id=$1',[watch.id,day,result.journeys[0]]);
      }catch(e){if([404,410].includes(e.statusCode))await client.query('DELETE FROM commute_watches WHERE id=$1',[watch.id]);else console.error('A commute check could not complete.');}
    }
    });
  }catch{console.error('Commute monitor needs PostgreSQL and routing services.');}finally{running=false;}
}
await tick();setInterval(tick,120000);console.log('Commute monitor running; checks every two minutes during commute windows.');
