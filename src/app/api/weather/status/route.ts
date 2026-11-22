import { NextResponse } from "next/server";
import { MAP_CENTER } from "@/lib/constants";
import { fetchCurrent } from "@/lib/weather";

// Diagnostic: shows whether the server can reach Open-Meteo, and the error if not.
export async function GET() {
  const started = Date.now();
  const res = await fetchCurrent(MAP_CENTER[0], MAP_CENTER[1]);
  return NextResponse.json(
    { ok: res.ok, source: res.source, ms: Date.now() - started, error: res.ok ? null : res.error, hours: res.ok ? res.hours.length : 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
