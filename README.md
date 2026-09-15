# TransitAI 🚇⚡

TransitAI is an intelligent commuting agent designed to take the friction out of daily public transport travel. Built for the **NebulaX Hackathon (Problem Statement 2)**, this web app proactively plans, monitors, and optimizes your commute using real-time transit data and your personal calendar. 

## 🌟 Key Features

* **AI Calendar Sync:** Automatically analyzes your upcoming events to suggest the best departure times and routes.
* **Proactive Disruption Handling:** Monitors real-time MRT service alerts and bus data to automatically reroute you before you even hit a delay.
* **Deep Personalization:** Users can fine-tune routing weights, prioritizing the fastest route, minimal walking, sheltered walkways, or avoiding crowded trains/buses.
* **Micro-Optimizations (Train Doors):** Advises you on exactly which train door to stand at for the fastest transfer or station exit based on rail station GeoJSON mapping.
* **Live Commuter Dashboard:** A high-performance, real-time map interface displaying alerts, live bus arrivals, and train congestion levels.

## 💻 Tech Stack

To ensure extreme speed and efficiency for a commuting app, we are using a modern, decoupled stack:

* **Frontend:** Next.js (React) with Tailwind CSS. Next.js App Router allows for React Server Components, delivering pre-rendered UI for instant loading times.
* **Mapping:** Mapbox GL JS. Utilizes WebGL for buttery-smooth vector rendering of station GeoJSON and route paths.
* **Backend:** FastAPI (Python). High-performance, asynchronous web framework. Perfect for handling rapid data ingestion, AI orchestrations, and concurrent route calculations.
* **Database & Auth:** Supabase (PostgreSQL + PostGIS). Provides rapid setup, secure authentication, and native geographic querying for spatial routing.
* **Caching:** Redis. Absolutely critical for caching real-time LTA DataMall APIs (bus arrivals, MRT alerts) to guarantee sub-millisecond response times and avoid rate limits.
* **AI Orchestration:** LangChain / OpenAI API. Powers the calendar-parsing agent and dynamic preference matching.

## 🚀 Getting Started
*(Instructions for your coding agent to set up the environment)*
1. Clone the repo.
2. Install frontend dependencies: `npm install`
3. Install backend dependencies: `pip install -r requirements.txt`
4. Set up `.env` with Supabase, Mapbox, and LTA DataMall keys.
