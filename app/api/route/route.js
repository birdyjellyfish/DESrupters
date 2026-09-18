import { NextResponse } from "next/server";

const DEFAULT_VALHALLA_URL = "http://localhost:8002";

function decodePolyline6(encoded) {
  const coordinates = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lon += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push([lon / 1e6, lat / 1e6]);
  }
  return coordinates;
}

function normalisePoint(point) {
  const lat = Number(point?.lat);
  const lon = Number(point?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("Route points must include valid latitude and longitude");
  if (lat < 1.1 || lat > 1.5 || lon < 103.5 || lon > 104.2) throw new Error("Both locations must be in Singapore");
  return { lat, lon, type: "break" };
}

function buildRequest(body) {
  const mode = body.mode === "bicycle" ? "bicycle" : "pedestrian";
  const points = [normalisePoint(body.origin), normalisePoint(body.destination)];
  const costingOptions = mode === "bicycle"
    ? {
        bicycle: {
          bicycle_type: "Hybrid",
          cycling_speed: 15,
          use_hills: body.preferences?.avoidHills ? 0 : 0.5,
          use_roads: 0.35,
        },
      }
    : {
        pedestrian: {
          walking_speed: body.preferences?.slowWalking ? 3.2 : 4.8,
          use_hills: body.preferences?.avoidHills ? 0 : 0.5,
          use_ferry: 0,
          use_lit: body.preferences?.preferSheltered ? 1 : 0.5,
        },
      };

  return {
    locations: points,
    costing: mode,
    costing_options: costingOptions,
    units: "kilometers",
    shape_format: "polyline6",
    directions_options: { units: "kilometers", language: "en-US" },
    id: "wayfinder-journey",
  };
}

function normaliseTrip(payload, mode) {
  const trip = payload.trip || payload;
  const legs = trip.legs || [];
  const coordinates = legs.flatMap((leg) => decodePolyline6(leg.shape || ""));
  const summary = trip.summary || {};
  const maneuvers = legs.flatMap((leg) => (leg.maneuvers || []).slice(0, 8).map((maneuver) => ({
    instruction: maneuver.instruction || maneuver.verbal_pre_transition_instruction || "Continue",
    lengthKm: Number(maneuver.length || 0),
    timeMinutes: Math.round(Number(maneuver.time || 0) / 60),
  })));
  return {
    mode,
    modeLabel: mode === "bicycle" ? "Valhalla bicycle route" : "Valhalla walking route",
    geojson: {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: { variant: "recommended", source: "valhalla" },
        geometry: { type: "LineString", coordinates },
      }],
    },
    summary: {
      distanceKm: Number(summary.length || 0),
      durationMinutes: Math.max(1, Math.round(Number(summary.time || 0) / 60)),
    },
    maneuvers,
  };
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const valhallaUrl = process.env.VALHALLA_URL || DEFAULT_VALHALLA_URL;
  if (!valhallaUrl) return NextResponse.json({ error: "VALHALLA_URL is not configured" }, { status: 503 });

  let routeRequest;
  try {
    routeRequest = buildRequest(body);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  try {
    const response = await fetch(`${valhallaUrl.replace(/\/$/, "")}/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(routeRequest),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) throw new Error(payload.error || `Valhalla returned ${response.status}`);
    return NextResponse.json(normaliseTrip(payload, routeRequest.costing), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      error: "Valhalla is not reachable. Start the local routing service and try again.",
      detail: error.message,
      code: "VALHALLA_UNAVAILABLE",
    }, { status: 503 });
  }
}
