# Wayfinder

## Persona

Arjun commutes from Punggol to one-north with a folding bicycle. He values comfort and predictability, and can adjust departure within roughly an hour. Wayfinder combines schedules, disruptions, crowds, weather and preferences into one recommendation, with alternatives one tap away.

The demo uses Waterway Sunrise II (824654) and Fusionopolis. Locations and mapped routes are real; the LRT suspension and rain switches are labelled **synthetic demonstrations**, not records of an actual incident.

## Implemented architecture

- **Next.js/React PWA:** onboarding, saved places, three-choice preferences, calendar ICS import, directions, map and offline journey caching.
- **Node backend:** OneMap search/transit schedules, DataMall alerts/crowds/forecasts/bus loads, data.gov.sg weather and preference scoring. No Python/LLM service is used.
- **Valhalla:** OSM walking/cycling geometry; OneMap active routing is the fallback. Transit schedules come from OneMap because this graph has no GTFS.
- **PostGIS:** supplied spatial layers, projected for metre-based overlap calculations and spatially indexed. Station footprints are polygons, not entrances.
- **Redis:** cached feeds, with a bounded in-process fallback.
- **Worker:** opt-in commute checks and Web Push. The combined Cloud Run image can start it alongside the web server; a PostgreSQL advisory lock coordinates checks between instances. The Compose setup keeps it in a separate container.

## Assumptions and evidence

`src/lib/server/planner.mjs` gathers candidates at allowed departure offsets, refines outdoor walks, rejects missed connections and scores time, walking, shelter, cycling, transfers, crowds and disruptions. Rain excludes cycling; folding-bike preferences add bus-boarding cost. This is heuristic ranking, not a trained model or globally optimal network search.

Station observations use corrected PLRT/SLRT codes and bounded freshness. Later boardings use half-hour forecasts. Bus occupancy/accessibility/type refer to each incoming bus; missing readings remain unknown.

Historical comparison is an **estimated demand proxy** using all four monthly passenger-volume endpoints. Hourly volume relative to the location's busiest hour is classified below 35% as low, below 70% as moderate, otherwise high. These thresholds are implementation choices in `src/lib/server/baselines.mjs`, not calibrated historical occupancy. The UI marks comparisons as estimates.

Evidence is reproducible with `npm test` and `npm run build` from `src/`. Mocked tests cover feed timing, loads, synthetic alerts, ranking, mapped distance units, missed connections, calendar priority, UI state, push recovery and offline retrieval. They do not establish real-world accuracy percentages. No fixed speed-up or measured crowd reduction is claimed; real durations vary with time and upstream feeds.

## Limitations

- Shelter coverage follows supplied geometry; internal concourses retain planner estimates. No guarantee of a fully sheltered path or measured walking-time accuracy is made.
- Passenger volumes do not measure normal occupancy of a specific bus/platform; missing/old data stays unavailable.
- No connected calendar OAuth, live bike availability, carriage/door guidance, lift-outage routing or multi-user load balancing is implemented.
- Background delivery requires a running worker and successful browser registration; provider failure can leave page-open alerts only.
- Offline journey text can survive lost connectivity; new routes and uncached tiles require a connection.
- Live providers require registration/keys. Tests need no paid API access; optional cloud hosting incurs infrastructure charges.
- Phone-sized browser checks have been performed; a recorded real-phone run and demo link are pending.

## Submission status

Repository: https://github.com/birdyjellyfish/DESrupters

Recording: **pending**. Follow `src/docs/submission/DEMO.md` and add a playable link. This is not a completed video submission. If organisers require captured evidence of a real disruption in addition to the labelled injected scenario, it remains to be collected.
