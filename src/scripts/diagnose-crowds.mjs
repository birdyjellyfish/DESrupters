// Run with node --env-file=.env scripts/diagnose-crowds.mjs. Never prints credentials or signed download links.
const endpoints = ['PCDRealTime?TrainLine=NEL','PCDRealTime?TrainLine=PLRT','PCDRealTime?TrainLine=PTL','PCDForecast?TrainLine=NEL','PV/Train','PV/Bus','PV/ODTrain','PV/ODBus'];
for (const endpoint of endpoints) {
  try {
    const r = await fetch(`https://datamall2.mytransport.sg/ltaodataservice/${endpoint}`,{headers:{AccountKey:process.env.LTA_ACCOUNT_KEY,Accept:'application/json'},signal:AbortSignal.timeout(10000)});
    const data = await r.json();
    const first = data.value?.[0];
    console.log(JSON.stringify({endpoint,status:r.status,count:Array.isArray(data.value)?data.value.length:null,keys:Object.keys(data),recordKeys:first && Object.keys(first),sample:endpoint.startsWith('PCDRealTime') && Array.isArray(data.value) ? data.value.slice(0,2) : undefined,forecast:first?.Stations?.slice(0,1).map(s=>({...s,Interval:s.Interval?.slice(0,2)}))}));
  } catch(e) {console.log(JSON.stringify({endpoint,error:e.message,code:e.cause?.code}));}
}
