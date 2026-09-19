# Data layout

- `spatial/`: eight supplied LTA ZIP inputs for `scripts/import-spatial.mjs`. Original archives and projection information are preserved.
- `fixtures/`: small labelled synthetic replay inputs, included with source.
- `crowd-baselines.json`: generated monthly profiles, ignored by Git.
- `valhalla/`: generated graph/config, ignored by Git; reuse or explicitly build it.
- `osm/`: optional downloaded `.osm.pbf` inputs, ignored by Git. The router serves the prepared graph, not the original PBF.

The combined Cloud Run image includes `osm/source.osm.pbf`, the prepared graph archive and its SQLite support files. Large local inputs remain excluded from the source repository.

Spatial inputs originate from LTA DataMall. OSM regional extracts come from [Geofabrik](https://download.geofabrik.de/asia/malaysia-singapore-brunei.html), based on © OpenStreetMap contributors. Attribution remains on the map. Keep credentials, push identities and calendars out of this folder.
