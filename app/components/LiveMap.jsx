"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";

const FALLBACK_ROUTE = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { variant: "recommended" },
      geometry: { type: "LineString", coordinates: [[103.945, 1.354], [103.93, 1.335], [103.87, 1.305], [103.852, 1.284]] },
    },
    {
      type: "Feature",
      properties: { variant: "alternative" },
      geometry: { type: "LineString", coordinates: [[103.945, 1.354], [103.91, 1.32], [103.87, 1.295], [103.852, 1.284]] },
    },
  ],
};

function getCoordinates(geojson) {
  return (geojson?.features || []).flatMap((feature) => feature.geometry?.coordinates || []);
}

export default function LiveMap({ routeGeoJson = FALLBACK_ROUTE, disrupted = false }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [mapError, setMapError] = useState("");
  const [webglAvailable, setWebglAvailable] = useState(null);
  const styleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL;

  useEffect(() => {
    const canvas = document.createElement("canvas");
    setWebglAvailable(Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl")));
  }, []);

  useEffect(() => {
    if (!styleUrl || webglAvailable !== true || !mapContainer.current || mapRef.current) return;
    // The default worker URL cannot resolve correctly through Next.js/webpack.
    maplibregl.setWorkerUrl(`/vendor/maplibre/${maplibregl.getVersion()}/maplibre-gl-worker.mjs`);
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center: [103.87, 1.32],
      zoom: 11,
      attributionControl: { compact: false, customAttribution: "© OpenStreetMap contributors" },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("error", (event) => {
      if (event?.error?.message) setMapError("Map tiles could not be loaded");
    });
    map.on("load", async () => {
      map.addSource("journey", { type: "geojson", data: routeGeoJson });
      map.addLayer({
        id: "journey-alternative",
        type: "line",
        source: "journey",
        filter: ["==", ["get", "variant"], "alternative"],
        paint: { "line-color": "#d06b4d", "line-width": 5, "line-dasharray": [1.5, 1.5], "line-opacity": 0.95 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addLayer({
        id: "journey-recommended",
        type: "line",
        source: "journey",
        filter: ["!=", ["get", "variant"], "alternative"],
        paint: { "line-color": disrupted ? "#d06b4d" : "#355f4d", "line-width": 6, "line-opacity": 0.95 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      try {
        const stations = await fetch("/data/rail-stations.geojson", { cache: "force-cache" }).then((response) => response.ok ? response.json() : null);
        if (stations) {
          map.addSource("rail-stations", { type: "geojson", data: stations });
          map.addLayer({ id: "rail-station-footprints", type: "fill", source: "rail-stations", paint: { "fill-color": "#8fae91", "fill-opacity": 0.12 } });
          map.addLayer({ id: "rail-station-outlines", type: "line", source: "rail-stations", paint: { "line-color": "#66836e", "line-width": 1, "line-opacity": 0.32 } });
        }
      } catch {
        // The route remains useful if the optional station footprint overlay is unavailable.
      }
      const coordinates = getCoordinates(routeGeoJson);
      if (coordinates.length > 1) {
        const bounds = coordinates.reduce((result, coordinate) => result.extend(coordinate), new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
        map.fitBounds(bounds, { padding: 44, maxZoom: 14, duration: 0 });
      }
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [styleUrl, webglAvailable]);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource("journey");
    if (source) source.setData(routeGeoJson);
    const layer = map?.getLayer("journey-recommended");
    if (layer) map.setPaintProperty("journey-recommended", "line-color", disrupted ? "#d06b4d" : "#355f4d");
    const coordinates = getCoordinates(routeGeoJson);
    if (map && coordinates.length > 1) {
      const bounds = coordinates.reduce((result, coordinate) => result.extend(coordinate), new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
      map.fitBounds(bounds, { padding: 44, maxZoom: 14, duration: 350 });
    }
  }, [routeGeoJson, disrupted]);

  if (!styleUrl) {
    return <div className="relative flex h-[285px] items-end overflow-hidden rounded-[28px] border border-[#dce4d9] bg-[#dfe7da] p-4"><div className="absolute inset-0 opacity-35" style={{ backgroundImage: "linear-gradient(115deg, transparent 48%, #bdcdbb 49%, transparent 50%), linear-gradient(25deg, transparent 48%, #c6d2c1 49%, transparent 50%)", backgroundSize: "92px 76px" }} /><div className="relative rounded-2xl bg-white/90 p-3 text-xs font-bold text-ink shadow-sm">Add `NEXT_PUBLIC_MAP_STYLE_URL` to render live OSM tiles.<span className="mt-1 block text-[10px] font-semibold text-moss">© OpenStreetMap contributors</span></div></div>;
  }

  if (webglAvailable !== true) {
    return <div className="relative flex h-[285px] items-end overflow-hidden rounded-[28px] border border-[#dce4d9] bg-[#dfe7da] p-4"><div className="absolute inset-0 opacity-35" style={{ backgroundImage: "linear-gradient(115deg, transparent 48%, #bdcdbb 49%, transparent 50%), linear-gradient(25deg, transparent 48%, #c6d2c1 49%, transparent 50%)", backgroundSize: "92px 76px" }} /><div className="relative rounded-2xl bg-white/95 p-3 text-xs font-bold text-ink shadow-sm">{webglAvailable === false ? "Enable WebGL or hardware acceleration to render the live map." : "Loading live map…"}<span className="mt-1 block text-[10px] font-semibold text-moss">© OpenStreetMap contributors</span></div></div>;
  }

  return <div className="relative overflow-hidden rounded-[28px] border border-[#dce4d9] bg-[#dfe7da] shadow-card"><div ref={mapContainer} className="h-[285px] w-full" />{mapError && <div className="absolute bottom-3 left-3 rounded-xl bg-white/95 px-3 py-2 text-[10px] font-bold text-[#a74d37] shadow-sm">{mapError}</div>}<div className="pointer-events-none absolute bottom-3 left-3 rounded-xl bg-white/90 px-2.5 py-1.5 text-[10px] font-bold text-moss shadow-sm">OSM route layer</div></div>;
}
