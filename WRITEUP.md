# Wayfinder

## Features
Our Wayfinder app is designed around the needs of Arjun, an active commuter. It focuses on three main features: calendar integration, preference-based routing, and smart disruption management.
Calendar Integration: Wayfinder allows users to upload calendar files exported from their existing calendar apps. It automatically identifies upcoming events and their locations, then uses its Valhalla-based routing engine to recommend an appropriate route and departure time.
Preference-Based Routing: During onboarding, users answer a series of questions about their commuting preferences, such as their priorities for comfort, speed, predictability, and crowding. Wayfinder uses these preferences to personalise route recommendations, rather than simply suggesting the fastest available route.
Smart Disruption Management: When disruptions such as service delays or severe weather affect a journey, Wayfinder proactively recommends alternative routes. Instead of directing every affected commuter towards the same alternative, users travelling along the affected segment can be distributed across different viable detours. This helps reduce the risk of overcrowding at particular alternatives, such as rail replacement shuttle services. Wayfinder then notifies each user of the disruption and provides a recommended detour that considers both current conditions and their travel preferences.

## Persona

Here’s a smoother and more professional version that keeps your original meaning while making the demo flow more naturally:
Scene 1 — Planning the Journey
The first scene of the demo depicts Arjun adding the Nebulax event to his calendar a day in advance. Arjun can sync his calendar events with Wayfinder, allowing it to recommend a suitable departure time and route based on his preferences, prioritising comfort and predictability.
Scene 2 — Timely Departure Reminder
The second scene shows Wayfinder reminding Arjun to leave for the LRT 15 minutes before it arrives. This gives him sufficient time to reach the station without rushing or waiting unnecessarily.
Scene 3 — Responding to Disruptions
The third scene shows Arjun receiving a notification from Wayfinder about an unexpected LRT disruption affecting his journey. Wayfinder automatically recommends an alternative route aligned with Arjun’s travel preferences, while still giving him the flexibility to explore and select other available routes.
Arjun follows the recommended alternative and cycles to Punggol MRT station, minimising the impact of the disruption on his journey.
Final Scene — Personalised Onboarding
The final scene demonstrates Wayfinder’s onboarding process and Arjun’s customised travel profile. His preferences, such as prioritising comfort and predictability, are used by Wayfinder to personalise future route recommendations and travel alerts.



## Implemented architecture

- **Next.js/React PWA:** onboarding, saved places, three-choice preferences, calendar ICS import, directions, map and offline journey caching.
- **Node backend:** OneMap search/transit schedules, DataMall alerts/crowds/forecasts/bus loads, data.gov.sg weather and preference scoring. No Python/LLM service is used.
- **Valhalla:** OSM walking/cycling geometry; OneMap active routing is the fallback. Transit schedules come from OneMap because this graph has no GTFS.
- **PostGIS:** supplied spatial layers, projected for metre-based overlap calculations and spatially indexed. Station footprints are polygons, not entrances.
- **Redis:** cached feeds, with a bounded in-process fallback.
- **Worker:** opt-in commute checks and Web Push. The combined Cloud Run image can start it alongside the web server; a PostgreSQL advisory lock coordinates checks between instances. The Compose setup keeps it in a separate container.
- **GCP:** We make use of Google Cloud Run to host the Valhalla server and Next.js server, limiting the amount of resources needed locally on the mobile device.

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
