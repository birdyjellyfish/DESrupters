## Wayfinder — Smart Commuter Companion

Wayfinder is a mobile-first web app for the NebulaX PS2 challenge. It is designed around Rachel, the fixed-schedule commuter, and demonstrates one real journey end to end: Tampines → Raffles Place, including walking legs, an EWL disruption, a revised bus route, crowd/weather context, and an offline cached-journey state.

### Run locally

Requirements: Node.js 18.17+, npm, Docker Desktop, and the Singapore/Malaysia/Brunei OSM PBF supplied with the challenge. The demo runs without credentials, while live LTA mode uses `LTA_ACCOUNT_KEY` in the root `.env` file. OneMap search uses the server-side `ONEMAP_KEY` value as its `Authorization` token. These credentials stay server-side and are never exposed to the browser.

```bash
npm install
npm run dev
```

Open http://localhost:3000. For a production check:

```bash
npm run build
npm start
```

### Live OSM map and Valhalla routing

MapLibre 6 requires an explicit worker URL when bundled with Next.js. The `predev`, `prebuild`, and `prestart` scripts copy its worker and shared ES modules from the installed package to `public/vendor/maplibre/<version>/`. The map configures this same-version worker before initialization. Keep these hooks when changing deployment scripts; missing worker modules cause an empty basemap with controls still visible.

The Plan tab sends the origin and destination to the server-side OneMap geocoder, then sends the resolved coordinates to Valhalla. The browser only receives the normalized route and renders it with MapLibre GL JS. Set `NEXT_PUBLIC_MAP_STYLE_URL` to an OSM-derived vector style from a permitted provider (or your own hosted style); do not point the app at the public `tile.openstreetmap.org` service for bulk application traffic. The map always displays `© OpenStreetMap contributors`.

Build the local Valhalla graph once from the supplied PBF:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-valhalla.ps1 -PbfPath "C:\Users\Moses\Downloads\malaysia-singapore-brunei-260917.osm.pbf"
docker compose -f docker-compose.valhalla.yml up -d
```

Keep `VALHALLA_URL=http://localhost:8002` in `.env`. The current preference-aware router supports pedestrian and bicycle routes. Valhalla transit routing needs transit data/GTFS in addition to the OSM road graph, so the existing LTA transit feed remains the source for disruption and crowd context while the live geometry comes from OSM.

### Demo walkthrough

1. The Today tab opens on Rachel’s usual EWL route with a door-to-door timeline and a map view. With `LTA_ACCOUNT_KEY` configured, the header changes to **LTA live** after the feeds load.
2. Tap **Test disruption** to inject a labelled Status 2 signal fault. The affected EWL segment is shown against the Bus 10 alternative, and the decision card explains the +11 minute trade-off.
3. Tap **Offline test** to surface the cached/stale journey state. The service worker in `public/sw.js` caches the app shell and GET requests.
4. Use Profile to switch to Arjun or Mdm Lim and see the decision lens change; use Plan to enter any Singapore origin and destination, then calculate a live walking or cycling route.
5. Tap the refresh icon under **Network glance** to re-fetch LTA TrainServiceAlerts, PCDRealTime and PCDForecast, plus the data.gov.sg two-hour weather feed.

### Architecture and data posture

The current submission is a self-contained frontend vertical slice. `app/api/transit/overview/route.js` is the server-side BFF seam: it calls LTA DataMall with the private `AccountKey` header, normalizes the nested alert/crowding/forecast payloads, and calls data.gov.sg weather without a key. `app/api/geocode/route.js` keeps the OneMap token server-side, while `app/api/route/route.js` proxies Valhalla and decodes its polyline6 response into GeoJSON. If an upstream request times out or is unavailable, the UI keeps running on labelled demo fixtures and shows the feed status. The live map uses MapLibre GL JS with an OSM-derived vector style, the provided rail-station footprints in `public/data/rail-stations.geojson`, and the required `© OpenStreetMap contributors` attribution. The supplied station GeoJSON has a null CRS but contains Singapore WGS84-like longitude/latitude coordinates, so it is rendered as EPSG:4326.

The next integration seam is to move the current request-through-BFF flow into a polling worker that caches LTA DataMall responses in Redis (TrainServiceAlerts, PCDRealTime, PCDForecast, BusArrival, FacilitiesMaintenance) and to add the Python/FastAPI decision service. Credentials belong in `.env`, never in source. See `.env.example` for optional variables. data.gov.sg weather endpoints do not require a key.

### Requirements covered

- Mobile-first, one-handed interaction with large touch targets and accessible labels.
- Route planning with walking, rail/bus legs, arrival time, uncertainty, and revised route output.
- Visual original-vs-alternative route layer with affected segment distinguished by pattern and colour.
- Proactive decision support for disruption, crowding, weather, and persona preferences.
- Offline/stale journey state and service-worker caching for underground travel.
- OpenStreetMap attribution and no public tile-server polling.
