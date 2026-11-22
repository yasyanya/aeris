import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureWeather } from "@/lib/data";

// Retries weather for reports whose retrieval failed. Call from a scheduler (e.g. every 15 min).
// Protect with CRON_SECRET in production: GET /api/cron/retry-weather?key=...
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (process.env.CRON_SECRET && key !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ids = getDb()
    .prepare("SELECT report_id FROM weather_snapshots WHERE fetch_status<>'ok' AND attempts<5 LIMIT 20")
    .all() as { report_id: number }[];
  let fixed = 0;
  for (const { report_id } of ids) if (await ensureWeather(report_id)) fixed++;
  return NextResponse.json({ checked: ids.length, fixed });
}
