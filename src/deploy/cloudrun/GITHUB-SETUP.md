# GitHub deployment for qwiklabs-gcp-02-09a07b4c9a6f

Leave the Cloud Run Dockerfile-only wizard. This application needs a Cloud Build configuration because its Dockerfile uses `src/` as the build context and its large routing inputs are outside Git. Use the Cloud Build trigger described in step 4 instead.

## 1. Create the supporting resources in Cloud Shell

These commands allocate resources in the supplied project. Run once for new resources; if a resource already exists, use its existing configuration rather than recreating it. Keep the same Cloud Shell session through steps 1 and 2.

```bash
export WAYFINDER_PROJECT=qwiklabs-gcp-02-09a07b4c9a6f
export WAYFINDER_REGION=asia-southeast1
export WAYFINDER_RUNTIME=wayfinder-runtime@$WAYFINDER_PROJECT.iam.gserviceaccount.com
export WAYFINDER_BUILDER=wayfinder-build@$WAYFINDER_PROJECT.iam.gserviceaccount.com
gcloud config set project "$WAYFINDER_PROJECT"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com iam.googleapis.com cloudresourcemanager.googleapis.com storage.googleapis.com

gcloud artifacts repositories create wayfinder --repository-format=docker --location="$WAYFINDER_REGION"
gcloud storage buckets create "gs://$WAYFINDER_PROJECT-wayfinder-data" --location="$WAYFINDER_REGION" --uniform-bucket-level-access
gcloud iam service-accounts create wayfinder-runtime --display-name='Wayfinder runtime'
gcloud iam service-accounts create wayfinder-build --display-name='Wayfinder build'

gcloud projects add-iam-policy-binding "$WAYFINDER_PROJECT" --member="serviceAccount:$WAYFINDER_RUNTIME" --role=roles/cloudsql.client
gcloud projects add-iam-policy-binding "$WAYFINDER_PROJECT" --member="serviceAccount:$WAYFINDER_RUNTIME" --role=roles/secretmanager.secretAccessor
gcloud projects add-iam-policy-binding "$WAYFINDER_PROJECT" --member="serviceAccount:$WAYFINDER_BUILDER" --role=roles/run.admin
gcloud projects add-iam-policy-binding "$WAYFINDER_PROJECT" --member="serviceAccount:$WAYFINDER_BUILDER" --role=roles/logging.logWriter
gcloud artifacts repositories add-iam-policy-binding wayfinder --location="$WAYFINDER_REGION" --member="serviceAccount:$WAYFINDER_BUILDER" --role=roles/artifactregistry.writer
gcloud storage buckets add-iam-policy-binding "gs://$WAYFINDER_PROJECT-wayfinder-data" --member="serviceAccount:$WAYFINDER_BUILDER" --role=roles/storage.objectViewer
gcloud iam service-accounts add-iam-policy-binding "$WAYFINDER_RUNTIME" --member="serviceAccount:$WAYFINDER_BUILDER" --role=roles/iam.serviceAccountUser

WAYFINDER_DB_PASSWORD="$(openssl rand -hex 24)"
WAYFINDER_DATABASE_URL="postgresql://postgres:$WAYFINDER_DB_PASSWORD@localhost/wayfinder?host=/cloudsql/$WAYFINDER_PROJECT:$WAYFINDER_REGION:wayfinder-db"
printf '%s' "$WAYFINDER_DATABASE_URL" | gcloud secrets create wayfinder-database-url --replication-policy=automatic --data-file=-
gcloud sql instances create wayfinder-db --database-version=POSTGRES_16 --edition=ENTERPRISE --tier=db-f1-micro --region="$WAYFINDER_REGION" --storage-size=10 --storage-type=SSD --assign-ip --root-password="$WAYFINDER_DB_PASSWORD"
gcloud sql databases create wayfinder --instance=wayfinder-db
unset WAYFINDER_DB_PASSWORD WAYFINDER_DATABASE_URL
```

Cloud SQL creation can take several minutes. The pipeline enables PostGIS and imports the spatial data using a Cloud Run Job before deploying the web revision. The small database tier is a demo starting point, not a production sizing recommendation. If the lab disallows an API, resource or IAM role, that project restriction must be resolved before this pipeline can run.

## 2. Add API and notification settings in Cloud Shell

Copy the values from your private local `src/.env` when prompted. Do not paste the whole `.env` into Git or the routing-data bucket.

```bash
read -r -s -p 'LTA AccountKey: ' WAYFINDER_LTA; echo
printf '%s' "$WAYFINDER_LTA" | gcloud secrets create wayfinder-lta-key --replication-policy=automatic --data-file=-
read -r -s -p 'OneMap token: ' WAYFINDER_ONEMAP; echo
printf '%s' "$WAYFINDER_ONEMAP" | gcloud secrets create wayfinder-onemap-key --replication-policy=automatic --data-file=-
unset WAYFINDER_LTA WAYFINDER_ONEMAP

export WAYFINDER_KEY_DIR="$(mktemp -d)"
node <<'NODE'
const {createECDH}=require('crypto');
const {writeFileSync}=require('fs');
const pair=createECDH('prime256v1');pair.generateKeys();
writeFileSync(process.env.WAYFINDER_KEY_DIR+'/public',pair.getPublicKey().toString('base64url'),{mode:0o600});
writeFileSync(process.env.WAYFINDER_KEY_DIR+'/private',pair.getPrivateKey().toString('base64url'),{mode:0o600});
NODE
gcloud secrets create wayfinder-vapid-public --replication-policy=automatic --data-file="$WAYFINDER_KEY_DIR/public"
gcloud secrets create wayfinder-vapid-private --replication-policy=automatic --data-file="$WAYFINDER_KEY_DIR/private"
rm "$WAYFINDER_KEY_DIR/public" "$WAYFINDER_KEY_DIR/private"
rmdir "$WAYFINDER_KEY_DIR"
unset WAYFINDER_KEY_DIR
```

These are a new stable push identity for the public website; enable notifications again on that URL after deployment. Keep the same keys for subsequent deployments. For an existing public service, reuse its keys instead of generating replacements.

## 3. Upload the six local data files once

Install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) on Windows if it is unavailable. Run in local PowerShell from the repository root, signed in with the account that has access to this lab project:

```powershell
gcloud auth login
powershell -ExecutionPolicy Bypass -File src/deploy/cloudrun/upload-routing-data.ps1
```

The script uploads only these objects under `gs://qwiklabs-gcp-02-09a07b4c9a6f-wayfinder-data/routing-v1/`:

```text
valhalla/valhalla_tiles.tar
valhalla/valhalla.json
valhalla/valhalla_tiles/admins.sqlite
valhalla/valhalla_tiles/timezones.sqlite
osm/source.osm.pbf
crowd-baselines.json
```

Alternatively upload those same files in the Cloud Storage console, preserving exactly that folder structure. They are already on the local machine under `src/data/`. No graph rebuild is required. The PBF is included in the image as requested; the graph is what Valhalla reads to serve routes. Update the bucket objects when intentionally updating the routing dataset/baseline, not for every source change.

## 4. Configure the GitHub trigger

Ensure `cloudbuild.yaml` and these helper files have been committed and pushed to GitHub before configuring the trigger.

The existing GitHub trigger has been reused as `wayfinder-main` in `global`. For a fresh project, create a trigger or update the existing one with these settings:

| Setting | Value |
| --- | --- |
| Name | `wayfinder-main` |
| Trigger region | `global` (existing connection); the service deploys to `asia-southeast1` |
| Event | Push to a branch |
| Repository | `birdyjellyfish/DESrupters` |
| Branch | `^main$` |
| Configuration | Cloud Build configuration file (YAML or JSON) |
| Location | Repository |
| Configuration file | `src/deploy/cloudrun/cloudbuild.yaml` |
| Service account | `wayfinder-build@qwiklabs-gcp-02-09a07b4c9a6f.iam.gserviceaccount.com` |
| Substitution `_MAP_STYLE_URL` | The complete `NEXT_PUBLIC_MAP_STYLE_URL` value from your local `src/.env` |

Other substitutions already target this project. If an Artifact Registry repository, bucket, service account or SQL instance was given a different name, update its substitution accordingly. Authorise the GitHub repository connection if prompted. Disable any duplicate Dockerfile-only trigger created through the earlier wizard, so a push does not launch two deployment pipelines.

Save the trigger and click **Run**, selecting `main`. The build downloads the routing data, builds with the correct context, pushes the image, imports spatial data, deploys the app and sets its public URL. Later pushes to `main` repeat this pipeline. The service uses 2 CPUs, 4 GiB RAM, concurrency 8, one minimum instance, a two-instance maximum and CPU allocation between requests for the monitor.

After a successful build, open **Cloud Run → wayfinder → URL**. Allow this hostname in your map provider's referrer settings if the map key is restricted. Complete onboarding and enable notifications on the public URL.

The routing inputs have been uploaded and the existing database, bucket, registry and service accounts reused in this project. Deployment status is available in Cloud Build. Existing dependency advisories are recorded in `src/docs/CLOUD-RUN-VERIFICATION.md`.

Sources: [Cloud Build deployment and trigger setup](https://docs.cloud.google.com/build/docs/deploying-builds/deploy-cloud-run), [Cloud Run Dockerfile build context](https://docs.cloud.google.com/run/docs/continuous-deployment), [Cloud SQL/PostGIS support](https://docs.cloud.google.com/sql/docs/postgres/extensions#postgis), [Cloud Storage downloads](https://docs.cloud.google.com/storage/docs/downloading-objects).
