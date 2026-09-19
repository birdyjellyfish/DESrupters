# Archived design proposal

This is the original proposal, not a description of completed functionality. See [WRITEUP.md](../../../WRITEUP.md) for the implemented architecture and limitations.

## 1. System Architecture & Modularity

The application is structured into five distinct, decoupled modules to allow parallel development by coding agents. This architecture ensures high-speed data ingestion without blocking the user interface, satisfying the strict performance requirements for mobile commuters.

## 2. Module 1: The Sensory Layer (Data Ingestion Pipeline)

This backend Node.js worker continuously polls official endpoints, normalizes the data, and stores it in Redis for rapid frontend retrieval.

*   **Disruption Feed Manager:** 
    *   Polls `TrainServiceAlerts` strictly for scheduled works, early closures, and live delays. 
    *   Parses the nested `AffectedSegments` list to extract `Line`, `Direction`, and mitigation details like `FreePublicBus` or `FreeMRTShuttle`.
    *   **Data Normalization:** Maps line codes to a canonical table (e.g., standardizing `STL` from alerts and `SLRT` from crowding data to a single internal ID).
*   **Crowding Telemetry Processor:**
    *   Aggregates three distinct crowding signals: `PCDRealTime` (10-minute refresh) for live station loads, `PCDForecast` (30-minute intervals) for predictive alerts, and the `Load` field from `v3/BusArrival` (`SEA`, `SDA`, `LSD`) for vehicle occupancy.
*   **Environmental & Infrastructure Sync:**
    *   Ingests the data.gov.sg 2-hour nowcast for weather conditions.
    *   Listens to `v2/FacilitiesMaintenance` for ad-hoc lift outages, triggering recalculations for accessibility-constrained users like the "Mdm Lim" persona.

## 3. Module 2: Geospatial & Custom Routing Engine (Valhalla + PostGIS)

This module handles the core "door-to-door" logic, heavily relying on OpenStreetMap data and LTA's geospatial overlays.

*   **Geospatial Base:** 
    *   Uses a Geofabrik extract of OpenStreetMap for Singapore. 
    *   Must strictly display "© OpenStreetMap contributors" on the UI to comply with ODbL licensing.
    *   Merges OSM with DataMall SHP layers: `CoveredLinkWay`, `TrainStationExit`, and `CyclingPath` for authoritative routing data.
*   **Dynamic Costing Algorithms:** 
    *   The routing engine utilizes dynamic penalty weights based on user preferences and live alerts.
    *   *Weather Response:* If the 2-hour nowcast indicates rain, the engine drastically reduces the "cost" (weight) of edges mapped to `CoveredLinkWay`. 
    *   *Crowd Response:* If a user (like the "Arjun" persona who optimizes for comfort) requests a route, stations flagged with an `h` (high) `CrowdLevel` from `PCDRealTime` receive a severe time penalty, forcing the engine to output bus or cycling alternatives.
*   **Micro-Routing (Station Geometry):**
    *   Uses `AmendmenttoMP2014RailStation.geojson` footprints to calculate exact walking times within stations.
    *   Maps exact carriage/door positions to the closest `TrainStationExit` to provide the "fastest exit" feature.

## 4. Module 3: AI & Decision Engine

This Python-based microservice handles predictive analytics, natural language processing, and advanced crowd control algorithms.

*   **Proactive Calendar Evaluator:**
    *   Ingests upcoming Google/Outlook calendar events. Uses `PCDForecast` and historical baselines from `PV/ODTrain` to detect if the user's standard commute will intersect with a planned road opening, scheduled maintenance, or abnormal crowd.
*   **Distributed Rerouting Algorithm:**
    *   When `TrainServiceAlerts` changes `Status` to `2` (disrupted), the system intercepts all active users heading toward the affected nodes.
    *   Instead of defaulting everyone to the `FreeMRTShuttle` (which causes extreme localized crowding), the algorithm buckets users by destination and assigns diverging bus routes, walking paths, or OneMap routing API alternatives to balance network load (this is based on the preferences for travel)

## 5. Module 4: User Profile & Preferences Manager

This module tailors the journey output to the exact needs of specific commuter personas.

*   **Preference Matrix:** Stores strict constraints versus soft preferences (amount of walking needed, wheelchair accessibility, sheltered walkways, amount of transfers needed).
    * Preferences are stored in terms of floats from 0 to 1 (with 1 being heavily preferenced towards,
    and 0 having no preference towards)
*   **Persona Configurations:**
    *   *Multi-Modal:* Enables multi-modal outputs (bike + LRT), strictly checks weather APIs, avoids `h` crowd levels, and evaluates `CyclingPath` data.
    *   *Focussed:* Minimizes notifications. Only triggers a reroute or alert if a disruption causes a delay exceeding a configurable threshold (e.g., 10+ minutes).
    *   *Accessibility:* Hard constraint on stairs. Requires `v2/FacilitiesMaintenance` lift status verification and strictly routes via `Footpath` and sheltered overhead bridges/underpasses with lifts.
    *   *Custom*: Users are able to setup custom preferences for the different dimensions as listed in the preference matrix above. 

## 6. Module 5: Mobile-First Frontend & Offline UI

The presentation layer is optimized for one-handed operation on a mobile device in bright sunlight or underground.

*   **Visual State Management:** 
    *   Uses MapLibre GL JS to render the route. 
    *   Affected segments (e.g., disrupted train lines) are visually contrasted against the alternative route to allow users to judge trade-offs instantly.
*   **Offline Degradation (Underground Mode):** 
    *   The frontend uses a Service Worker to cache the full JSON payload of the active journey, including alternate paths. 
    *   When cellular signal drops between stations, the UI explicitly flags the data as cached/stale and allows the user to continue reviewing their route and exit strategy.
*   **Proactive Alerts**
    * The user will be sent a notification by the web app when there is a change in the recommended route (due to unplanned events like service disruptions/inclement weather etc.). This notification should include the detour instructions as well as the reason for the detour. 
