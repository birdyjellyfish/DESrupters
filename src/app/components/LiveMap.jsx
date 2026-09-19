"use client";
import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
const EMPTY = { type:'FeatureCollection',features:[] };
const geometries=(data,comparison)=>JSON.stringify([data.features.map(f=>f.geometry),(comparison?.geojson?.features || []).map(f=>f.geometry)]);
function updateJourney(map, data, journey, fit, comparisonJourney) {
  map.getSource('journey')?.setData(data);
  const comparing=Boolean(comparisonJourney);
  for(const id of ['journey-transit','journey-walk','journey-cycle']) {
    map.setPaintProperty(id,'line-color',comparing?'#754494':id==='journey-cycle'?'#754494':id==='journey-transit'?['match',['get','mode'],'bus','#b36927','#355f4d']:'#355f4d');
    map.setPaintProperty(id,'line-dasharray',comparing?[1,1]:id==='journey-transit'?[1,0]:id==='journey-cycle'?[3,1]:[1.5,1.5]);
  }
  map.getSource('comparison')?.setData(comparisonJourney?.geojson || EMPTY);
  const disrupted=[...data.features,...(comparisonJourney?.geojson?.features || [])].filter(f=>f.properties.affected).map(f=>({type:'Feature',properties:{},geometry:{type:'Point',coordinates:f.geometry.coordinates[Math.floor(f.geometry.coordinates.length/2)]}}));
  map.getSource('disruptions')?.setData({type:'FeatureCollection',features:disrupted});
  const points = journey?.legs.map((l,i) => ({ type:'Feature',properties:{number:String(i+1),crowd:l.crowd?.level || '',label:`${i+1}. ${l.from.name}`},geometry:{type:'Point',coordinates:[l.from.lon,l.from.lat]} })) || [];
  if (journey?.legs.length) { const last=journey.legs.at(-1); points.push({type:'Feature',properties:{number:'✓',label:last.to.name},geometry:{type:'Point',coordinates:[last.to.lon,last.to.lat]}}); }
  map.getSource('stops')?.setData({type:'FeatureCollection',features:points});
  const coords = [...data.features,...(comparisonJourney?.geojson?.features || [])].flatMap(f => f.geometry.coordinates);
  if (fit && coords.length>1) map.fitBounds(coords.reduce((bounds,c)=>bounds.extend(c),new maplibregl.LngLatBounds(coords[0],coords[0])),{padding:42,maxZoom:16,duration:400});
}
export default function LiveMap({routeGeoJson=EMPTY,journey,layers=true,comparisonJourney}) {
  comparisonJourney=comparisonJourney?.affected && comparisonJourney.id!==journey?.id?comparisonJourney:null;
  const container=useRef(null), mapRef=useRef(null), latest=useRef({routeGeoJson,journey,comparisonJourney}), geometryKey=useRef('');
  const [error,setError]=useState(''),[layerMessage,setLayerMessage]=useState('');
  const layerRef=useRef(layers), refresh=useRef(null);
  latest.current={routeGeoJson,journey,comparisonJourney};
  const style=process.env.NEXT_PUBLIC_MAP_STYLE_URL;
  useEffect(() => {
    if (!style || !container.current) return;
    // MapLibre 6 worker and shared module must be same-version static files (prepared by npm prehooks).
    maplibregl.setWorkerUrl(`/vendor/maplibre/${maplibregl.getVersion()}/maplibre-gl-worker.mjs`);
    let map;
    try { map=new maplibregl.Map({container:container.current,style,center:[103.84,1.35],zoom:10.5,attributionControl:{compact:false,customAttribution:'© OpenStreetMap contributors'}}); }
    catch { setError('Map rendering could not start. Check WebGL support and your map style.'); return; }
    mapRef.current=map;
    map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
    map.on('error',()=>setError('Some map resources could not load. Check your map provider key and connection.'));
    let controller;
    const loadLayers=async()=>{
      controller?.abort();
      if (!map.getSource('infrastructure')) return;
      if(!layerRef.current || map.getZoom()<14) {map.getSource('infrastructure').setData(EMPTY);setLayerMessage('');return;}
      controller=new AbortController();
      const b=map.getBounds(); const bbox=[Math.max(103.5,b.getWest()),Math.max(1.1,b.getSouth()),Math.min(104.2,b.getEast()),Math.min(1.5,b.getNorth())];
      try {
        const response=await fetch(`/api/map/layers?bbox=${bbox.join(',')}&layers=shelter,footpath,crossing,cycling,station,exit,bus_stop,taxi`,{signal:controller.signal});
        const data=await response.json(); if(!response.ok)throw new Error(data.error);
        if(!mapRef.current)return;
        map.getSource('infrastructure')?.setData(data);setLayerMessage(data.truncated?'Zoom in to see all local layers':'');
      } catch(e) {if(e.name!=='AbortError')setLayerMessage(e.message || 'Layers unavailable');}
    };
    refresh.current=loadLayers;
    map.on('load',()=>{
      map.addSource('infrastructure',{type:'geojson',data:EMPTY});
      map.addLayer({id:'infra-area',type:'fill',source:'infrastructure',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':['match',['get','layer'],'shelter','#259582','crossing','#b17d32','#799881'],'fill-opacity':0.42}});
      map.addLayer({id:'infra-path',type:'line',source:'infrastructure',filter:['==',['geometry-type'],'LineString'],paint:{'line-color':['match',['get','layer'],'cycling','#9961ae','#259582'],'line-width':2,'line-opacity':0.65}});
      map.addLayer({id:'infra-point',type:'circle',source:'infrastructure',filter:['==',['geometry-type'],'Point'],paint:{'circle-color':['match',['get','layer'],'exit','#259582','bus_stop','#c27628','#8e669e'],'circle-radius':4,'circle-stroke-color':'#ffffff','circle-stroke-width':1}});
      map.addSource('comparison',{type:'geojson',data:EMPTY});
      map.addLayer({id:'comparison-route',type:'line',source:'comparison',filter:['!=',['get','affected'],true],paint:{'line-color':'#87918d','line-width':3,'line-opacity':0.5,'line-dasharray':[2,2]}});
      map.addLayer({id:'comparison-affected',type:'line',source:'comparison',filter:['==',['get','affected'],true],paint:{'line-color':'#b62828','line-width':8,'line-dasharray':[1,1]}});
      map.addSource('journey',{type:'geojson',data:EMPTY});
      map.addLayer({id:'journey-halo',type:'line',source:'journey',paint:{'line-color':'#ffffff','line-width':9}});
      map.addLayer({id:'journey-transit',type:'line',source:'journey',filter:['in',['get','mode'],['literal',['bus','rail','other']]],paint:{'line-color':['match',['get','mode'],'bus','#b36927','#355f4d'],'line-width':5}});
      map.addLayer({id:'journey-walk',type:'line',source:'journey',filter:['==',['get','mode'],'walk'],paint:{'line-color':'#355f4d','line-width':4,'line-dasharray':[1.5,1.5]}});
      map.addLayer({id:'journey-cycle',type:'line',source:'journey',filter:['==',['get','mode'],'cycle'],paint:{'line-color':'#754494','line-width':5,'line-dasharray':[3,1]}});
      map.addLayer({id:'journey-affected',type:'line',source:'journey',filter:['==',['get','affected'],true],paint:{'line-color':'#b62828','line-width':7,'line-dasharray':[1,1]}});
      map.addSource('stops',{type:'geojson',data:EMPTY});
      map.addLayer({id:'stop-circles',type:'circle',source:'stops',paint:{'circle-radius':14,'circle-color':['match',['get','crowd'],'l','#b4e3ca','m','#f5d475','h','#f3a18e','#ffffff'],'circle-stroke-color':'#12221c','circle-stroke-width':2}});
      map.addLayer({id:'stop-numbers',type:'symbol',source:'stops',layout:{'text-field':['get','number'],'text-size':11,'text-allow-overlap':true},paint:{'text-color':'#12221c'}});
      map.addSource('disruptions',{type:'geojson',data:EMPTY});
      map.addLayer({id:'disruption-marker',type:'circle',source:'disruptions',paint:{'circle-radius':14,'circle-color':'#b62828','circle-stroke-color':'#ffffff','circle-stroke-width':3}});
      map.addLayer({id:'disruption-symbol',type:'symbol',source:'disruptions',layout:{'text-field':'!','text-size':19,'text-allow-overlap':true},paint:{'text-color':'#ffffff'}});
      updateJourney(map,latest.current.routeGeoJson,latest.current.journey,true,latest.current.comparisonJourney);
      geometryKey.current=geometries(latest.current.routeGeoJson,latest.current.comparisonJourney);
      loadLayers();
    });
    map.on('click','stop-circles',e=>{const f=e.features?.[0];if(f)new maplibregl.Popup().setLngLat(f.geometry.coordinates).setText(f.properties.label).addTo(map);});
    map.on('click','infra-point',e=>{const f=e.features?.[0];if(f)new maplibregl.Popup().setLngLat(e.lngLat).setText([f.properties.stn_name,f.properties.exit_code,f.properties.BUS_STOP_N,f.properties.LOC_DESC].filter(Boolean).join(' · ')||f.properties.layer).addTo(map);});
    map.on('moveend',loadLayers);
    return()=>{controller?.abort();refresh.current=null;mapRef.current=null;map.remove();};
  },[style]);
  useEffect(()=>{
    if(!mapRef.current?.getSource('journey'))return;
    const key=geometries(routeGeoJson,comparisonJourney);
    updateJourney(mapRef.current,routeGeoJson,journey,key!==geometryKey.current,comparisonJourney);
    geometryKey.current=key;
  },[routeGeoJson,journey,comparisonJourney]);
  useEffect(()=>{layerRef.current=layers;refresh.current?.();},[layers]);
  return <div className="overflow-hidden rounded-3xl border border-fog bg-white shadow-card">{journey && comparisonJourney && <div className="flex flex-wrap gap-x-4 gap-y-2 px-3 py-3 text-xs font-semibold"><span className="flex items-center gap-2 text-[#754494]"><span aria-hidden="true" className="w-5 border-t-[3px] border-dotted border-[#754494]"/>Recommended ({Math.ceil(journey.durationSeconds/60)} min)</span><span className="flex items-center gap-2 text-[#b62828]"><span aria-hidden="true" className="w-5 border-t-[3px] border-dotted border-[#b62828]"/>Disrupted route ({Math.ceil(comparisonJourney.durationSeconds/60)} min)</span></div>}<div ref={container} className="h-[340px] w-full bg-fog" aria-label="Singapore journey map"/>{!style && <p className="p-3 text-xs text-red-800">Map unavailable · © OpenStreetMap contributors</p>}{error && <p role="status" className="p-3 text-xs text-red-800">{error}</p>}{layers && layerMessage && <p role="status" className="px-4 py-3 text-[11px] text-moss">{layerMessage}</p>}</div>;
}
