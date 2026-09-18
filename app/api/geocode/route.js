import { NextResponse } from "next/server";

const ONEMAP_BASE = "https://www.onemap.gov.sg";

async function getOneMapToken() {
  const apiKey = process.env.ONEMAP_KEY || process.env.ONEMAP_API_KEY || process.env.ONEMAP_ACCESS_TOKEN;
  if (!apiKey) throw new Error("OneMap API key is not configured");
  return apiKey;
}

export async function GET(request) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json({ error: "Enter at least two characters" }, { status: 400 });
  }

  try {
    const token = await getOneMapToken();
    const searchParams = new URLSearchParams({
      searchVal: query,
      returnGeom: "Y",
      getAddrDetails: "Y",
      pageNum: "1",
    });
    const response = await fetch(`${ONEMAP_BASE}/api/common/elastic/search?${searchParams}`, {
      headers: { Authorization: token, Accept: "application/json" },
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || `OneMap search failed (${response.status})`);

    const results = (payload.results || []).slice(0, 5).map((result) => ({
      label: result.SEARCHVAL || result.ADDRESS || query,
      address: result.ADDRESS || result.SEARCHVAL || query,
      postal: result.POSTAL || "",
      lat: Number(result.LATITUDE),
      lon: Number(result.LONGITUDE),
    })).filter((result) => Number.isFinite(result.lat) && Number.isFinite(result.lon));

    return NextResponse.json({ query, results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to search OneMap" }, { status: 502 });
  }
}
