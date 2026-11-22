import { NextResponse } from "next/server";
import { MAP_BOUNDS } from "@/lib/constants";
import { rateLimit } from "@/lib/ratelimit";

// Server-side proxy to OpenStreetMap Nominatim so residents' IPs are not sent to a third party.
// Nominatim policy: at most 1 request/second and an identifying User-Agent (generic here).
let last = 0;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json({ results: [] });
  if (!rateLimit("geocode:global", 50, 60_000).ok || Date.now() - last < 1000)
    return NextResponse.json({ results: [], error: "Search is busy. Try again in a moment." }, { status: 429 });
  last = Date.now();
  const [[s, w], [n, e]] = MAP_BOUNDS;
  const params = new URLSearchParams({
    q,
    format: "jsonv2",
    limit: "5",
    countrycodes: "us",
    viewbox: `${w - 0.1},${n + 0.1},${e + 0.1},${s - 0.1}`,
    bounded: "1",
  });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": "Aeris-community-odor-prototype/0.1", "Accept-Language": "en" },
      signal: AbortSignal.timeout(6000),
    });
    const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
    return NextResponse.json({
      results: data.map((d) => ({ label: d.display_name.split(", ").slice(0, 3).join(", "), lat: Number(d.lat), lon: Number(d.lon) })),
    });
  } catch {
    return NextResponse.json({ results: [], error: "Address search is unavailable. Drop a pin on the map instead." }, { status: 502 });
  }
}
