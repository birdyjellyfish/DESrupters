export const DEMO_HOME={label:'Home · Waterway Sunrise II (824654)',lat:1.398523513583436,lon:103.9196728863388};
export const DEMO_WORK={label:'Work · Fusionopolis',lat:1.300053424282201,lon:103.7882024744311};
export const PUNGGOL_MRT={label:'Punggol MRT',name:'PUNGGOL MRT STATION',code:'NE17',lat:1.4042876,lon:103.9019468};
export function demoOptions(value) { return {rain:value?.rain===true,disruption:value?.disruption===true}; }
// Deliberately matches the DataMall TrainServiceAlerts response envelope.
export function demoDisruption(now=Date.now()) {
  return {value:{Status:2,AffectedSegments:[{Line:'PTL',Direction:'Both',Stations:['PTC',...Array.from({length:7},(_,i)=>`PE${i+1}`),...Array.from({length:7},(_,i)=>`PW${i+1}`)].join(','),FreePublicBus:'N',FreeMRTShuttle:'N'}],Message:[{Content:'Demo: Punggol LRT service suspended on both loops. Use a bus or cycle to Punggol MRT.',CreatedDate:new Date(now).toISOString()}]}};
}
