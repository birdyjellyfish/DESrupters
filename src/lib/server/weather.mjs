import { cached } from './cache.mjs';
export async function weatherForecast() {
  return cached('weather:two-hour',300,async () => {
    try {
      const response = await fetch('https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast',{signal:AbortSignal.timeout(5000),cache:'no-store'});
      if (!response.ok) throw new Error();
      const { data } = await response.json();
      const item = data?.items?.at(-1);
      if (!item?.valid_period?.end) throw new Error();
      return { observedAt:item.update_timestamp, validUntil:item.valid_period.end, areas:(item.forecasts || []).map(f => ({...f,location:data.area_metadata?.find(a => a.name === f.area)?.label_location})) };
    } catch { return {unavailable:true,areas:[]}; }
  });
}
export function journeyWeather(weather,origin,demo={}) {
  if(demo.rain) return {wet:true,forecast:'Heavy rain',source:'demo',advice:'Bring an umbrella.'};
  if(demo.disruption) return {wet:false,forecast:'Dry weather',source:'demo',advice:null};
  const area=weather?.areas?.filter(a=>a.location).sort((a,b)=>((a.location.latitude-origin.lat)**2+(a.location.longitude-origin.lon)**2)-((b.location.latitude-origin.lat)**2+(b.location.longitude-origin.lon)**2))[0];
  const valid=Date.parse(weather?.validUntil)>Date.now();
  const wet=valid && /rain|showers|thunder/i.test(area?.forecast || '');
  return {wet,forecast:valid?area?.forecast:null,source:valid?'data.gov.sg':'unavailable',advice:wet?'Bring an umbrella.':null};
}
