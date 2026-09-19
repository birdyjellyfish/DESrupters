# Wayfinder — a proactive Singapore commute companion

Built for **Arjun**, a Punggol-to-one-north commuter who values predictable, less crowded journeys and can walk, cycle, take transit or leave later.

[Source repository](https://github.com/birdyjellyfish/DESrupters) · [Write-up](WRITEUP.md) · [Submission checklist](src/docs/submission/CHECKLIST.md)

**Demo recording: pending.** Add the actual playable recording URL here before submission. The repository link is not a recording. The included disruption scenario is clearly labelled synthetic, not a captured real incident.

## Prerequisites

- Node.js **22 LTS** and npm; the lockfile is included.
- Docker Desktop on Windows/macOS, or Docker Engine with Compose on Linux. Start Docker first.
- Internet access and the provider credentials below. Automated tests need no credentials; live search/routing requires OneMap.

## Install and run on a clean machine

```bash
git clone https://github.com/birdyjellyfish/DESrupters.git
cd DESrupters/src
npm ci
npm run setup
```

All app commands run inside `src/`. `setup` reads the root `../.env.example` and creates a private `src/.env` with matching local database credentials and portable service URLs; it leaves an existing `.env` unchanged. Open `src/.env` in a text editor and fill these three blank values:

| Variable | Obtain it from |
| --- | --- |
| `ONEMAP_KEY` | [OneMap registration](https://www.onemap.gov.sg/apidocs/register) and [token generation](https://www.onemap.gov.sg/apidocs/authentication). A registered account and valid token are needed for search and routing. |
| `LTA_ACCOUNT_KEY` | [LTA DataMall](https://datamall.lta.gov.sg/), **Request for API Access**. The free registered key supplies alerts, crowds and bus occupancy. |
| `NEXT_PUBLIC_MAP_STYLE_URL` | A MapLibre vector style URL, e.g. from [MapTiler](https://www.maptiler.com/cloud/). Provider free-plan quotas apply. Include the browser map key in the URL. |

Then run from the same `src/` directory:

```bash
docker compose -f docker-compose.data.yml up -d --wait
npm run data:import
npm run data:crowds
npm run dev
```

Open **http://127.0.0.1:3000**. `npm run dev` starts the web app and notification monitor; Ctrl+C stops them. For a UI-only run: `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000`.

The eight spatial ZIPs are in `data/spatial/`. The crowd import needs DataMall and downloads four monthly volume datasets. If it fails, journeys remain usable but historical comparisons stay unavailable.

The app can run without a local Valhalla graph: walking/cycling falls back to OneMap's mapped paths. No Python service or LLM account is required by the implemented app.

## Optional local Valhalla

Large OSM downloads and routing tiles are not source deliverables. Copy separately supplied tiles, archive and config into `data/valhalla/`, then run:

```bash
docker compose -f docker-compose.valhalla.yml up -d
```

To build a new graph, download the [Geofabrik regional OSM extract](https://download.geofabrik.de/asia/malaysia-singapore-brunei.html). Explicitly provide its location on Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-valhalla.ps1 -PbfPath "C:\path\to\input.osm.pbf"
docker compose -f docker-compose.valhalla.yml up -d
```

This optional build needs time and disk space; installation/startup never regenerates the graph. Cloud deployment can upload existing tiles and the source OSM file without rebuilding.

## What to click first

1. Skip or complete onboarding. Replay it from **Settings → Start onboarding**.
2. In **Settings → Try Arjun's commute**, enable **Punggol LRT disruption**, then **Run demo**.
3. This loads **824654 → Fusionopolis**. Compare the purple recommendation with the original journey; only affected LRT segments are red.
4. Enable **Wet weather** too and rerun. Cycling is excluded and the advice becomes “Bring an umbrella.” Bus choices/times depend on real schedules.
5. Open **Other journeys** or journey directions. Crowd details distinguish live readings, forecasts and historical estimates.

The [synthetic alert fixture](src/data/fixtures/punggol-lrt-disruption.json) and runtime generator in `src/lib/demo.mjs` reproduce a disruption even on a quiet day. Night-time transit availability may differ. Saved home/work are not changed by the demo.

## Configuration and persistence

`.env.example` lists names only. `setup` fills `DATABASE_URL`, `POSTGRES_PASSWORD`, `REDIS_URL` and `VALHALLA_URL`. Optional push settings are `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; omitted keys are generated in ignored `.local/`. `PUBLIC_APP_URL` supplies the canonical public origin behind a proxy. `NEXT_DIST_DIR` selects an optional separate build directory.

Home/work, preferences, imported events and saved journeys stay on the device. Calendar integration is **ICS import**, not connected Google/Outlook accounts. Background notifications need opt-in, a running monitor and a working push service. Databases/private settings are not submitted. Cached journey text survives offline; uncached basemap tiles may not.

## Repository map

```text
DESrupters/
├── README.md             setup and run instructions
├── WRITEUP.md            persona, architecture and limitations
├── .env.example          environment variable names only
└── src/                  runnable project; run npm/Docker commands here
    ├── app/              Next.js pages, UI and API endpoints
    ├── lib/              domain logic and server providers
    ├── public/           logo, assets, manifest and service worker
    ├── data/             spatial inputs and synthetic fixtures
    ├── scripts/          setup, imports, worker and reference audit
    ├── tests/            mocked API, routing, UI and offline tests
    ├── deploy/           existing container support files
    ├── docs/             supporting documentation
    ├── package.json      dependencies and app commands
    └── …                 Next.js, Docker and test configuration
```

## Demo
https://youtu.be/zaRmnHdUYxo