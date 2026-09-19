# Operations reference

Commands below run from `src/`. Start with the root [README.md](../../README.md) for clean-machine setup; it supersedes the older setup examples below. Spatial ZIPs are in `src/data/spatial/`.

# Wayfinder — Singapore multimodal commuter companion

A mobile-first planner for Arjun and a custom profile. Search Singapore addresses, landmarks or postal codes; select an exact result; compare walking, cycling, MRT/LRT and bus journeys. Named demos are confined to Settings and clearly label simulated conditions; schedules and paths still come from the configured routing services.

## Start locally

Use Node.js 22 and Docker Desktop. Install dependencies inside `src/` with `npm ci`. Keep `src/.env` private; configuration names are in the root `.env.example`.

```powershell
# Start Docker Desktop first. These commands reuse existing volumes and routing tiles.
docker compose -f docker-compose.data.yml -f docker-compose.valhalla.yml up -d

# Once per new spatial-data release (does NOT regenerate Valhalla):
npm run data:import

npm run dev
```

`npm run dev` and `npm start` also start the commute notification monitor; it stops when the web server exits. The monitor sends only to subscriptions explicitly enabled in the app. For a UI-only preview, run `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3005`.

Open [the local app](http://localhost:3000). Stop containers with the same compose files and `down`; do not use `down -v` unless you intend to delete the data volumes. There is no need to re-import spatial data on each startup.

Required configuration:

- `ONEMAP_KEY`: server-only OneMap access key/token, used in the Authorization header for search and transit routing. Expired or rejected credentials must be replaced by the account owner.
- `LTA_ACCOUNT_KEY`: server-only DataMall AccountKey for alerts, station crowding and bus arrivals.
- `NEXT_PUBLIC_MAP_STYLE_URL`: MapLibre-compatible **vector** style URL, e.g. your MapTiler style. This URL/key is necessarily public; restrict the map-provider key for your deployment.
- `VALHALLA_URL`: defaults to `http://localhost:8002`, using the existing OSM routing graph.
- `DATABASE_URL`: defaults to `postgresql://wayfinder:wayfinder-local-only@localhost:5433/wayfinder`.
- `REDIS_URL`: defaults to `redis://localhost:6379`.

The compose database password is local-development-only. Set `POSTGRES_PASSWORD` and the matching `DATABASE_URL` for other environments. All database/cache ports bind to localhost. No new calendar API key is required.

## Journey planning

1. Select **From** and **To** from debounced OneMap suggestions, or use your current Singapore location as the origin.
2. First launch offers optional onboarding: home/work, three-choice shelter/walking/crowd questions, bicycle handling, flexible departure and weekday commute times. Reopen it under **Settings → Start onboarding**. Arjun prioritises comfort and can leave up to an hour later.
3. Plan now or select a departure in Singapore time. Transit service may not be available overnight.
4. Tap **Let's go**. Open the prominent recommended journey, or reveal **Other journeys** to compare alternatives. Open directions on each leg. Rail legs identify the line, boarding/alighting stations, intermediate stops and station crowd readings. Bus legs identify the service and stop codes, scheduled departure, next three live arrivals where available, occupancy and vehicle type.
5. Local map layers are on by default; zoom in to see them. Toggle layers under **Settings**, alongside profiles and calendar import. Preferences persist on this device.

Transit schedules/geometry come from OneMap's public-transport API. Separate transit, rail and bus requests produce diverse candidates, deduplicated to at most six. These are real returned itineraries—not a guarantee that every journey uses both MRT and bus. Valhalla refines outdoor walking links using OSM, preserving OneMap's internal station transfers. Candidates that would miss a scheduled boarding window are rejected. Walking alternatives and whole itineraries are ranked using measured shelter, walking cost and current crowd data. Valhalla's graph has no GTFS; we **do not claim it calculates the MRT/bus schedule**.

Rail alerts are matched to the leg's station sequence. Affected options are strongly penalised, and returned bus-only alternatives can serve as detours. If no unaffected route is available, the UI says so. Live updates every 30 seconds (while visible and online) refresh crowds/arrivals/alerts without silently replacing the chosen itinerary; **Let's go** recalculates the route and ranking after a disruption.

### Accuracy and limits

- MRT crowd data describes a station/platform, **not carriage occupancy**. Missing, expired or unrecognised observations display Unavailable. Bus occupancy belongs to the currently reported incoming bus, not necessarily a bus in a later scheduled journey.
- Timetables are scheduled estimates. LTA bus estimates are shown separately; transfer feasibility is checked against the timetable, not guaranteed against future traffic delays.
- Shelter is an **estimate** from overlap with supplied polygon footprints plus a 3 m alignment tolerance. It is not proof of continuous rain cover or current access. Preferences re-rank returned candidates, not every possible path through Singapore.
- Exits are identified near the selected walking geometry and labelled as mapped nearby. Follow station signage; entrance availability and indoor connectivity are not live-verified.
- Cycling uses Valhalla bicycle costing or OneMap cycle routing. Direct rides and first/last-mile cycling compete with feeder buses. Cycling access includes time to prepare and fold/park. Folding-bike profiles may carry the bike; park-before-transit profiles get no last-mile bike assumption. LTA folded-size guidance is shown. Rain disables cycling. Taxi stands remain geographic context only.
- Direct walking/cycling paths are requested independently of transit, so a short campus trip can work without a bus or train. Valhalla kilometre distances are converted to metres; OneMap distances are already metres. If a verified walk misses boarding, that itinerary is rejected instead of retaining the shorter estimate. If both street routers fail, original transit walking links remain with a notice; standalone active routes are never fabricated. If PostGIS is unavailable, shelter is explicitly unknown.

The welcome screen uses Singapore local time, the nearest area forecast from data.gov.sg (cached five minutes), and current LTA disruptions. Expired or unavailable weather and disruption observations are labelled accordingly.

## Calendar import

In **Settings**, import a `.ics`/`.ical` export (up to 2 MB). Parsing happens entirely in the browser; the calendar file, event title and other calendar contents are not uploaded. The next future timed event appears in **Up next**. On launch, a same-day event away from home/work takes priority. A unique search match is selected automatically; ambiguous locations need confirmation. Otherwise the app suggests work in the morning and home later in the day. With no saved places/events it retains manual search. Choose **Find this location & plan arrival**, select the correct OneMap result, and plan from your chosen origin. Only location searches and routing coordinates/times are sent to routing services. If background notifications are enabled, confirmed event coordinates/times and commute settings are stored on this app’s server; event titles are omitted.

Supports recurrence, EXDATE, UID-scoped overrides, cancelled events, embedded VTIMEZONE, UTC and Asia/Singapore. Floating times are interpreted as Singapore time. All-day events need an explicit time and are reported rather than assigned an invented departure. Unsupported timezones are reported. The next 90 days are inspected; transit planning is limited to OneMap's 30-day future window. The next 20 parsed events persist locally and can be cleared in Settings; the original ICS file is not stored. Re-import to receive changes from the source calendar. This is **not** a subscription or account sync.

For event trips the server probes near the event, estimates an earlier departure with a 10-minute buffer, then replans at that time. Options arriving before the event are prioritised. It reports when none arrive on time. This is an estimate, not an arrival guarantee.

## Spatial data and persistence

`scripts/import-spatial.mjs` reads the eight supplied ZIPs in `data/`. Shapefile `.prj` definitions are read by shpjs (the supplied layers use SVY21) and reprojected to WGS84. Every coordinate is checked against Singapore bounds. PostGIS retains both EPSG:4326 and EPSG:3414 geometries with GiST indexes; all overlap measurements use metres. Each layer replacement is transactional. Original ZIPs and the Valhalla tile archive are untouched.

The existing `public/data/rail-stations.geojson` is a separate polygon-footprint reference, not points. Its originally null CRS was checked against Singapore longitude/latitude bounds; the new spatial queries use the projected/imported station layer rather than blindly assigning a CRS to that file.

`rail_line_codes` and the central application line-code map normalise LTA/OneMap aliases, including BPL/STL/PTL. Redis caches station crowds for 10 minutes, forecasts for 24 hours with a Singapore-date cache key, bus arrivals for 30 seconds, and service alerts for 60 seconds. Failed feeds are negatively cached briefly. Connections are pooled, duplicate in-flight requests coalesced, and a bounded memory cache supports temporary Redis outages.

The active journey is stored on this device. The service worker caches matching POST route payloads and the app shell; it never returns app HTML for worker/module/API requests. Offline directions are labelled stale. **Clear saved journey** removes local journey state and route-cache entries. Parsed upcoming calendar events, home/work and commute preferences persist locally; raw calendar files do not. Basemap tiles may be unavailable offline; text directions remain usable. Avoid shared-device use for sensitive travel history, or clear the saved journey afterward.

MapLibre 6 requires the explicit same-version worker URL configured in `LiveMap.jsx`. Keep the `predev`, `prebuild`, and `prestart` hooks that copy the worker and shared ES module into `public/vendor/maplibre/`. All maps retain OpenStreetMap attribution; no public OSM tile scraping is used.

## Verification

```powershell
npm test
npm run build
node scripts/check-spatial.mjs
```

When a dev server is already running, build into a separate output directory in PowerShell with `$env:NEXT_DIST_DIR='.next-preview-build'; npm run build` to avoid sharing its compilation files. Use the same `NEXT_DIST_DIR` when starting that production build.

Jest/React Testing Library tests mock external APIs and cover profile scoring, transit normalisation, crowd freshness, bus occupancy, synthetic Status 2 disruption matching, calendar recurrence/timezones, accessible search selection, walking/boarding timing, calendar arrival planning and service-worker offline POST retrieval. The spatial check requires the imported local database. Never regenerate the routing graph without the owner's approval.

API references: [OneMap routing](https://www.onemap.gov.sg/apidocs/routing), [OneMap search](https://www.onemap.gov.sg/apidocs/search), [LTA DataMall documentation](https://datamall.lta.gov.sg/content/datamall/en/dynamic-data.html).

### Before public deployment

The inherited Next.js 14.2.35 dependency currently has security advisories (`npm audit --omit=dev`: one critical Next.js finding and one high transitive PostCSS finding). The local scripts deliberately bind to `127.0.0.1`. Upgrade the framework to a patched supported release and re-run build/browser tests before exposing this app publicly. A major framework migration is not bundled into this routing feature change. Add authentication/rate limits to the BFF before a public launch to protect provider quotas.

## Crowd data and typical demand

Run `npm run diagnose:crowds` to inspect bounded, credential-free feed diagnostics. Crowd requests translate alert codes PTL/STL to PLRT/SLRT and use CEL/CGL for extension stations. Recent completed observation windows remain usable for at most ten minutes after their end; older readings and NA stay unknown. Later boarding/alighting uses the applicable half-hour forecast, never a present reading labelled as a future prediction. Bus Load, wheelchair accessibility and type are shown for each actual arriving vehicle. A bus departure outside the matching live window correctly remains unknown.

Run `npm run data:crowds` to import the latest PV/Train, PV/Bus, PV/ODTrain and PV/ODBus archives (or pass YYYYMM). The importer streams CSVs into hourly, weekday/weekend profiles and writes `data/crowd-baselines.json` atomically. Refresh monthly; baselines older than 100 days are unavailable. OD records corroborate origin demand rather than being treated as per-service occupancy.

**“More/Less crowded than normal (estimate)” is a passenger-flow proxy, not measured historical density.** Typical demand is this hour’s volume as a share of the location’s busiest hour: below 35% low, below 70% moderate, otherwise high. It is compared with the live/forecast ordinal reading, with the method and source visible in crowd details. Monthly weekday/weekend aggregates cannot establish what an individual Tuesday or a specific bus is normally like. Missing data is never silently replaced with low crowding.

Routing compares actual departures at 0/20/40/60 minutes when preferences allow, penalises high and above-baseline crowds, and retains fixed calendar deadlines. Time comparisons include waiting before the first connection. The original and selected journeys are overlaid, with disrupted legs hatched and crowd markers labelled L/M/H.

## Demonstrations and notifications

Settings has independent **Wet weather** and **Punggol LRT disruption** switches for 824654 → Fusionopolis. Rain pauses cycling and suggests an umbrella. The disruption injects a DataMall-shaped Status 2 payload for both Punggol LRT loops; the planner avoids affected rail connections and uses Valhalla for street paths. In dry weather it can cycle to Punggol MRT; with rain it compares bus access. OneMap still supplies train/bus schedules: Valhalla has no GTFS in this setup. Both toggles can be combined. Demo state is not restored on reload and does not change saved home/work.

In-app detour checks run every two minutes, with live observations refreshed separately. The app offers a preferred detour without silently replacing the selected journey. Enable **Detour notifications** from Settings to request browser permission and store a push subscription. The server monitor checks near weekday commute times and same-day confirmed events, deduplicates alerts, and removes invalid subscriptions. Disable deletes the stored watch. Watches expire after 30 days without a settings sync. Background delivery needs a running server/monitor and a browser/platform supporting Web Push (secure context; iOS requires the installed PWA). No notification is sent merely by opening the page.

Web Push keys are generated into ignored `.local/push-keys.json` for local development. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and a valid VAPID_SUBJECT for deployment; preserve keys across restarts. `npm run monitor` can run the worker separately when the web server is hosted elsewhere. Do not run duplicate workers. Tests mock push delivery, external feeds and weather.

### Push registration recovery

Push setup validates the server public key and retries a transient browser push-service failure once. If registration still fails, an explicit enable action opts into notifications while the page is open; the app does not claim that background push is enabled or save a new server watch. The UI explains the limitation and allows another attempt. Turning notifications off clears this fallback too. The local key pair was checked for a matching P-256 public/private pair; browser push-service rejection can still require checking site permissions or managed browser/network policies. Tests exercise recovery and fallback without contacting a real push provider.

Map comparisons now appear only for a disrupted original route, with purple dotted recommended paths, neutral grey unaffected comparison sections, and red dotted affected segments. Crowd colors remain subtle; station markers show step numbers without L/M/H codes. Onboarding radio groups have unique IDs so hidden Settings controls cannot clear their selection. Commute times remain editable under Travel preferences. Settings → Start onboarding replays the first-run setup for demos.

## Logo and Google Cloud deployment

The user-supplied transparent bird logo is stored unchanged at `public/branding/wayfinder-bird-512.png` (512 × 512). The app header, browser icon and installed-app icon all use this image. Existing container configuration remains under `src/`; the deployment guide has been removed.
