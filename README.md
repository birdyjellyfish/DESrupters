# README.md

## Smart Commuter Companion: AI-Driven Proactive Routing

This mobile-first web application provides proactive decision support for commuters facing both planned and unplanned transport events. It transitions the commuter experience from reactive to proactive by analyzing calendar schedules, monitoring real-time transit telemetry, and delivering personalized, optimized routes before the commuter even reaches the platform. 

### Core Features
*   **Proactive Calendar Integration:** Synchronizes with user calendars to pre-calculate journeys and push alerts before departure if disruptions or crowding are forecast.
*   **Dynamic Multi-Modal Routing:** Generates door-to-door routes integrating rail, bus, walking, and cycling, adapting to live conditions like weather and traffic.
*   **Micro-Optimizations:** Recommends specific train doors for the fastest transfers and utilizes exact exit data for precision routing.
*   **Crowd-Distributed Rerouting:** In the event of service unavailability, the AI distributes affected users across multiple viable alternative paths to prevent secondary bottlenecks on shuttle services.
*   **Offline Resilience:** Progressive Web App (PWA) architecture caches active journeys to ensure the app remains functional underground where cellular signal is lost.

### Tech Stack Overview
*   **Frontend:** Next.js (React), Tailwind CSS, PWA Service Workers.
*   **Map Rendering:** MapLibre GL JS rendering OpenStreetMap (OSM) vector tiles.
*   **Backend & Data Layer:** Node.js API routes, Redis (caching), PostgreSQL with PostGIS (geospatial storage).
*   **Routing Engine:** Valhalla (self-hosted) for multi-modal pathfinding and dynamic costing adjustments based on user preferences.
*   **AI Engine:** Python (FastAPI) utilizing LLMs for calendar parsing and crowd control.

### Setup Instructions
1. Clone the repository and configure `.env` with LTA DataMall AccountKey, data.gov.sg API access, and OneMap credentials. Ensure no credentials are hardcoded.
2. Initialize the PostGIS database and ingest `AmendmenttoMP2014RailStation.geojson` (verify coordinate reference system first).
3. Run the Redis instance for rate-limiting and caching LTA API calls.
4. Start the Python AI microservice (port 8000) and Next.js frontend (port 3000).