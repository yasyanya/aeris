import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { reportInput } from "@/lib/schema";
import { insertReport, runScreening, saveWeather } from "@/lib/reports-core";
import { fetchAround } from "@/lib/weather";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const ip = await clientIp();
  const rl = rateLimit(`report:${ip}`, 12, 60 * 60_000);
  if (!rl.ok)
    return NextResponse.json(
      { error: "Too many reports from this connection. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterS) } },
    );

  const body = await req.json().catch(() => null);
  const parsed = reportInput.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Please check the highlighted fields.", issues: parsed.error.issues }, { status: 400 });

  const user = await currentUser();
  const db = getDb();
  const v = parsed.data;
  // 1. Save first, so the report is never lost even if weather fails.
  const { id, receiptCode } = insertReport(db, { ...v, userId: user?.role === "resident" ? user.id : null });

  // 2. Attach weather (best effort). Failures are recorded and retried later.
  const at = new Date(v.observedAt);
  let weatherStatus: "ok" | "failed" = "failed";
  try {
    const w = await fetchAround(v.lat, v.lon, at);
    saveWeather(db, id, at, w);
    weatherStatus = w.ok ? "ok" : "failed";
  } catch (e) {
    saveWeather(db, id, at, { ok: false, source: "open-meteo", error: e instanceof Error ? e.message : String(e) });
  }
  // 3. Screening for staff (stored, not shown to the public).
  try {
    runScreening(db, id);
  } catch (e) {
    console.error("[aeris] screening failed", e);
  }
  return NextResponse.json({ receiptCode, weatherStatus }, { status: 201 });
}
