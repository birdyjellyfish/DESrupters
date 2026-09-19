jest.mock('../lib/server/cache.mjs',()=>({cached:jest.fn((key,ttl,fn)=>fn())}));
import { weatherForecast,journeyWeather } from '../lib/server/weather.mjs';

test('wet demo advice stays concise without explaining demo routing rules',()=>{
  expect(journeyWeather({}, {lat:1.4,lon:103.9}, {rain:true,disruption:true})).toMatchObject({wet:true,advice:'Bring an umbrella.'});
});
test('keeps forecast validity and area coordinates without inventing weather',async()=>{
  global.fetch=jest.fn(async()=>({ok:true,json:async()=>({data:{area_metadata:[{name:'Clementi',label_location:{latitude:1.315,longitude:103.76}}],items:[{valid_period:{end:'2026-09-19T12:00:00+08:00'},forecasts:[{area:'Clementi',forecast:'Showers'}]}]}})}));
  const result=await weatherForecast();expect(result.areas[0]).toMatchObject({forecast:'Showers',location:{latitude:1.315}});expect(result.validUntil).toBe('2026-09-19T12:00:00+08:00');
  fetch.mockRejectedValue(new Error('offline'));expect(await weatherForecast()).toEqual({unavailable:true,areas:[]});
});
