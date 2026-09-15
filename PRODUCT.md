# TransitAI: Product & System Documentation

This document serves as the master blueprint for the coding agent. The application is modularized to ensure separation of concerns, maintainability, and parallel development.

---

## MODULE 1: Data Ingestion & Caching Layer (The "Nerve Center")
**Purpose:** Handle all external public transport APIs efficiently without bottlenecking the app.
**Stack:** Python FastAPI, Redis, background workers (Celery or APScheduler).

*   **Sub-Module 1.1: Polling Engine:** Background tasks that fetch data from LTA DataMall every 15-60 seconds.
*   **Sub-Module 1.2: Redis Cache:** 
    *   Stores `Public MRT service alerts` (TTL: 60s).
    *   Stores `Real-time train arrivals` (TTL: 30s).
    *   Stores `Bus service data for alternate routing` (TTL: 30s).
*   **Data Normalization:** Converts raw API responses into standardized JSON formats for the Routing Engine.

---

## MODULE 2: Core Routing & Preference Engine
**Purpose:** Calculate the best path from A to B considering dynamic weights (user preferences) and live disruptions.
**Stack:** FastAPI, Python (NetworkX/OSMnx for graph algorithms), PostGIS.

*   **Sub-Module 2.1: Graph Construction:** Builds a transit graph using the `Rail station GeoJson` and bus routes. 
*   **Sub-Module 2.2: The Weighting Algorithm:** Modifies edge weights (travel time/cost) on the graph based on:
    *   *Weather/Shelter:* Increases cost of outdoor walking edges if raining.
    *   *Crowd Levels:* Increases cost of heavily congested bus/MRT edges.
    *   *Disruptions:* Severes (removes) edges where MRT services are disrupted.
*   **Sub-Module 2.3: Route Generation:** Runs A* or Dijkstra's algorithm on the modified graph to output top 3 routes (Fastest, Most Comfortable, Least Walking).

---

## MODULE 3: AI Calendar & Context Agent
**Purpose:** Proactively plan trips based on the user's schedule.
**Stack:** OpenAI API (Function Calling), Google Calendar / Microsoft Graph API integrations.

*   **Sub-Module 3.1: Calendar Sync:** Fetches events with location tags for the next 24 hours.
*   **Sub-Module 3.2: AI Intent Parser:** LLM parses the location strings into exact geocordinates (via Mapbox Geocoding API).
*   **Sub-Module 3.3: Commute Scheduler:** Calculates "time-to-leave" based on output from Module 2 and sends push notifications (e.g., "Leave in 10 mins to catch the less crowded bus 196").

---

## MODULE 4: Micro-Optimization (Door & Transfer Mapping)
**Purpose:** Save seconds on transfers by guiding users to the optimal train doors.
**Stack:** Static Data Store (JSON/PostgreSQL).

*   **Sub-Module 4.1: Station Topography Mapping:** Maps specific exits and transfer escalators to specific train carriage/door numbers.
*   **Sub-Module 4.2: Injection into Route:** Appends door recommendations to the final route steps (e.g., "Board carriage 3, door 2 for direct access to escalator at Bishan Interchange").

---

## MODULE 5: Frontend Interface & Mapping
**Purpose:** Provide a fast, intuitive, and interactive user experience.
**Stack:** Next.js (App Router), Tailwind CSS, Zustand (State Management), Mapbox GL JS.

*   **Sub-Module 5.1: Interactive Map:** Renders base map, station GeoJSON, and polyline routes. Highlights disrupted lines in red.
*   **Sub-Module 5.2: Trip Planner UI:** Inputs for origin/destination, sliders for preferences (Speed vs. Comfort vs. Walking).
*   **Sub-Module 5.3: Itinerary View:** Step-by-step breakdown of the journey, including live countdowns and the door micro-optimization data.
*   **Sub-Module 5.4: Disruption Banners:** Real-time WebSocket or SSE (Server-Sent Events) listener that flashes alerts if the user's *current* active route is suddenly disrupted.

---

## API CONTRACTS (Internal)

### 1. `POST /api/v1/route`
*   **Payload:** `{ origin: [lat, lng], dest: [lat, lng], preferences: { speed: 0.8, shelter: 0.2, avoid_crowds: 0.9 } }`
*   **Response:** `[ { path: [...], duration: 45, type: "Fastest" }, ... ]`

### 2. `GET /api/v1/alerts/live`
*   **Response:** `{ active_disruptions: [ { line: "EWL", type: "Delay", message: "+15 mins" } ] }`
