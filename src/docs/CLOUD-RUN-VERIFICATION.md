# Cloud Run image verification — 19 September 2026

Local image: `wayfinder-cloudrun:local`

Image ID: `sha256:a94a46139db9505e24043e577d01cf100c413ee76c17c01150c7f260ba5ef769`

Verified on Docker Desktop using Linux/amd64, a 2-CPU limit and 4-GiB memory limit:

- Linux production build succeeded; only production Node dependencies are included in the runtime image.
- The image contains the 679,854,080-byte Valhalla graph archive and 251,002,369-byte PBF. SHA-256 checksums match the original files.
- Graph SHA-256: `7bf31738f223952617b4cd5ff68dd092526df88185e366f9edd232305849622c`.
- PBF SHA-256: `2a770f6f58b81a0feb2925d3f7821d229706f16909f290d335f1adf4470df563`.
- Supporting SQLite files are included without duplicating the extracted routing tile tree.
- The app and logo returned HTTP 200; `/.env` returned 404. The image has no private `.env` file.
- Valhalla returned HTTP 200 and non-empty pedestrian and bicycle routes between `(1.3085, 103.7734)` and `(1.3053, 103.7735)`.
- The app responded through the host's published port, confirming it is reachable outside the container loopback interface.
- Graceful container shutdown completed with exit code 0. The temporary test container was removed; the image remains available locally.
- Seven notification/monitor-lock tests passed. The targeted reference audit had no findings.

Cloud SQL connectivity, imported production spatial data, live provider credentials, background push delivery and Cloud Run itself have not been tested in a Google Cloud project. No cloud resources were created or images uploaded.

The dependency audit reported two existing production advisories: critical severity for Next.js 14.2.35 and high severity for its nested PostCSS. The audit recommends a major Next.js upgrade; that migration is outside this container change and remains unresolved. This image is a functioning deployment artifact, not a claim of production security readiness.
