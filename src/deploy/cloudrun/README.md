# Combined Cloud Run image

This image contains the production Next.js app, Node.js, Valhalla, the existing routing graph, its supporting SQLite databases, the supplied OSM PBF, spatial import inputs and an optional historical crowd baseline. It does not rebuild the graph or unpack it at startup. The PBF is retained for rebuilding/provenance; serving routes uses the prepared graph.

Build from `src/` with Docker Desktop running Linux containers:

```powershell
docker build --platform linux/amd64 -f deploy/cloudrun/Dockerfile --build-arg "NEXT_PUBLIC_MAP_STYLE_URL=YOUR_MAP_STYLE_URL" -t wayfinder-cloudrun:local .
```

The Dockerfile-specific ignore file admits these large local inputs, even though Git and the ordinary Dockerfile exclude them:

- `data/valhalla/valhalla_tiles.tar`
- `data/valhalla/valhalla.json`
- `data/valhalla/valhalla_tiles/admins.sqlite` and `timezones.sqlite`
- `data/osm/source.osm.pbf` — copied from the supplied `malaysia-singapore-brunei-260917.osm.pbf`

Private `.env` files and `.local/` are excluded. Supply API credentials at runtime. The map style is public browser configuration and is embedded at build time.

## Runtime requirements

The web server binds `0.0.0.0:$PORT` (8080 by default); Valhalla binds only `127.0.0.1:8002`. The supervisor waits for Valhalla, starts the web process and optional monitor, and stops the instance if a child fails. Cloud Run provides HTTPS; Caddy is not part of this image.

Use an external PostgreSQL database with PostGIS, preferably Cloud SQL. **Do not run the database inside this image:** Cloud Run's writable filesystem is ephemeral. Redis is optional; without `REDIS_URL`, the app uses its existing bounded in-process fallback. For multiple instances, configure shared Redis to share feed caching.

Required runtime values for the full app:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Persistent PostgreSQL/PostGIS connection |
| `LTA_ACCOUNT_KEY`, `ONEMAP_KEY` | Live provider credentials |
| `PUBLIC_APP_URL` | The public HTTPS Cloud Run URL |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | A stable matching Web Push identity, retained between deployments |
| `RUN_COMMUTE_MONITOR` | Set to `true` to run proactive checks; default is `false` |
| `REDIS_URL` | Optional shared Redis endpoint |

For a Cloud SQL socket, attach the instance to Cloud Run and grant the service identity the Cloud SQL Client role. An example connection URL is `postgresql://USER:URL_ENCODED_PASSWORD@localhost/DATABASE?host=/cloudsql/PROJECT:REGION:INSTANCE`. Run the bundled `scripts/import-spatial.mjs` once against that database, with a user allowed to enable PostGIS. Cloud Run Jobs can use this same image with command `node` and argument `scripts/import-spatial.mjs`; this overrides the normal service entrypoint. The crowd baseline can be refreshed before rebuilding using `npm run data:crowds`.

Start with **2 vCPU, 4 GiB memory, concurrency 8 and generation 2**; this is a starting configuration, not a load-tested capacity claim. For the monitor, use **at least one minimum instance and instance-based billing (`--no-cpu-throttling`)** so checks continue without incoming requests. A PostgreSQL advisory lock coordinates concurrent monitor checks during revision overlap. These settings incur idle running costs and do not guarantee uninterrupted notification delivery.

## Image deployment versus GitHub

Use this local image for the first deployment: tag it for Artifact Registry, push it, then select it in Cloud Run. No source archive is required. GitHub integration still builds and deploys a container; it does not supply the ignored routing files. For later CI/CD, keep the source on GitHub and fetch the dataset from Cloud Storage in the build, or copy it from a versioned dataset image in Artifact Registry. Do not commit the graph/PBF to Git.

```powershell
gcloud auth configure-docker asia-southeast1-docker.pkg.dev
docker tag wayfinder-cloudrun:local asia-southeast1-docker.pkg.dev/YOUR_PROJECT/YOUR_REPOSITORY/wayfinder:latest
docker push asia-southeast1-docker.pkg.dev/YOUR_PROJECT/YOUR_REPOSITORY/wayfinder:latest
```

The Artifact Registry repository, Cloud SQL instance, IAM access and runtime credentials must be configured in your project. Creating this image does not create or deploy those resources.

References: [Cloud Run container contract](https://docs.cloud.google.com/run/docs/container-contract), [Cloud SQL connection](https://docs.cloud.google.com/sql/docs/postgres/connect-run), [background CPU allocation](https://docs.cloud.google.com/run/docs/configuring/billing-settings), [GitHub continuous deployment](https://docs.cloud.google.com/run/docs/continuous-deployment).
