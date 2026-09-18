import { NextResponse } from "next/server";

const LTA_BASE_URL = "https://datamall2.mytransport.sg/ltaodataservice";
const WEATHER_URL = "https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast";
const REQUEST_TIMEOUT_MS = 7000;

const fallback = {
  source: "demo",
  isLive: false,
  fetchedAt: new Date().toISOString(),
  alerts: {
    status: 1,
    segments: [],
    messages: [],
  },
  crowd: {
    line: "EWL",
    station: "EW2",
    level: "l",
    label: "Low",
    startTime: null,
    endTime: null,
  },
  forecast: {
    line: "EWL",
    station: "EW2",
    level: "l",
    label: "Low",
    startTime: null,
    endTime: null,
  },
  weather: {
    label: "Rain unlikely",
    probability: null,
    area: "Singapore",
  },
};

function getArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.value)) return payload.value;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function crowdLabel(level) {
  return { l: "Low", m: "Moderate", h: "High", NA: "Unavailable" }[level] || "Unavailable";
}

async function fetchJson(url, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Upstream responded ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeAlerts(payload) {
  const root = payload?.value && !Array.isArray(payload.value) ? payload.value : payload;
  const segments = getArray(root?.AffectedSegments ?? root?.affectedSegments);
  const messages = getArray(root?.Message ?? root?.message);
  const status = Number(root?.Status ?? root?.status ?? 1);
  return {
    status: status === 2 ? 2 : 1,
    segments: segments.map((segment) => ({
      line: segment.Line ?? segment.line ?? "Unknown line",
      direction: segment.Direction ?? segment.direction ?? "Both",
      stations: segment.Stations ?? segment.stations ?? "",
      freePublicBus: segment.FreePublicBus ?? segment.freePublicBus ?? "",
      freeMrtShuttle: segment.FreeMRTShuttle ?? segment.freeMrtShuttle ?? "",
      shuttleDirection: segment.MRTShuttleDirection ?? segment.mrtShuttleDirection ?? "",
    })),
    messages: messages.map((message) => ({
      content: message.Content ?? message.content ?? String(message),
      createdDate: message.CreatedDate ?? message.createdDate ?? null,
    })),
  };
}

function normalizeCrowd(payload, line, stationCode = "EW2") {
  const values = getArray(payload);
  const station = values.find((item) => (item.Station ?? item.station) === stationCode) || values[0] || {};
  const level = station.CrowdLevel ?? station.crowdLevel ?? "NA";
  return {
    line,
    station: station.Station ?? station.station ?? stationCode,
    level,
    label: crowdLabel(level),
    startTime: station.StartTime ?? station.startTime ?? null,
    endTime: station.EndTime ?? station.endTime ?? null,
  };
}

function normalizeForecast(payload, line, stationCode = "EW2") {
  const records = getArray(payload);
  const record = records[0] || {};
  const stations = getArray(record.Stations ?? record.stations);
  const station = stations.find((item) => (item.Station ?? item.station) === stationCode) || stations[0] || {};
  const intervals = getArray(station.Interval ?? station.interval);
  const now = Date.now();
  const current = intervals
    .map((item) => ({
      level: item.CrowdLevel ?? item.crowdLevel ?? "NA",
      startTime: item.Start ?? item.start ?? null,
    }))
    .filter((item) => item.startTime)
    .sort((a, b) => Math.abs(new Date(a.startTime).getTime() - now) - Math.abs(new Date(b.startTime).getTime() - now))[0] || { level: "NA", startTime: null };
  return {
    line,
    station: station.Station ?? station.station ?? stationCode,
    level: current.level,
    label: crowdLabel(current.level),
    startTime: current.startTime,
    endTime: null,
  };
}

function normalizeWeather(payload) {
  const records = getArray(payload?.data?.records ?? payload?.records ?? payload?.data);
  const first = records[0] || {};
  const forecasts = getArray(first?.forecasts ?? first?.Forecasts);
  const eastForecast = forecasts.find((item) => /east|tampines|bedok/i.test(item.area || item.Area || "")) || forecasts[0] || {};
  const forecast = eastForecast.forecast ?? eastForecast.Forecast ?? "Unknown";
  return {
    label: forecast,
    probability: null,
    area: eastForecast.area ?? eastForecast.Area ?? "Singapore",
  };
}

export async function GET() {
  const accountKey = process.env.LTA_ACCOUNT_KEY;
  if (!accountKey) {
    return NextResponse.json({ ...fallback, warning: "LTA_ACCOUNT_KEY is not configured" }, { headers: { "Cache-Control": "no-store" } });
  }

  const ltaHeaders = { AccountKey: accountKey };
  const results = await Promise.allSettled([
    fetchJson(`${LTA_BASE_URL}/TrainServiceAlerts`, ltaHeaders),
    fetchJson(`${LTA_BASE_URL}/PCDRealTime?TrainLine=EWL`, ltaHeaders),
    fetchJson(`${LTA_BASE_URL}/PCDForecast?TrainLine=EWL`, ltaHeaders),
    fetchJson(WEATHER_URL),
  ]);

  const [alertsResult, crowdResult, forecastResult, weatherResult] = results;
  const allLtaAvailable = alertsResult.status === "fulfilled" && crowdResult.status === "fulfilled" && forecastResult.status === "fulfilled";
  const response = {
    source: allLtaAvailable ? "lta" : "mixed",
    isLive: allLtaAvailable,
    fetchedAt: new Date().toISOString(),
    alerts: alertsResult.status === "fulfilled" ? normalizeAlerts(alertsResult.value) : fallback.alerts,
    crowd: crowdResult.status === "fulfilled" ? normalizeCrowd(crowdResult.value, "EWL", "EW2") : fallback.crowd,
    forecast: forecastResult.status === "fulfilled" ? normalizeForecast(forecastResult.value, "EWL", "EW2") : fallback.forecast,
    weather: weatherResult.status === "fulfilled" ? normalizeWeather(weatherResult.value) : fallback.weather,
  };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "no-store",
      "X-Wayfinder-Data-Source": response.source,
    },
  });
}
