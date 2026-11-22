import { NextResponse } from "next/server";
import { currentUser, isStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || !isStaff(u.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ids = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 25);
  if (!ids.length) return NextResponse.json({ results: [] });
  const rows = getDb()
    .prepare(
      `SELECT r.id, r.receipt_code, r.lat, r.lon, r.observed_at, r.intensity, s.result_json FROM reports r
       LEFT JOIN screening_results s ON s.report_id=r.id WHERE r.id IN (${ids.map(() => "?").join(",")})`,
    )
    .all(...ids) as { id: number; receipt_code: string; lat: number; lon: number; observed_at: string; intensity: number; result_json: string | null }[];
  return NextResponse.json({
    results: rows.map((r) => ({
      id: r.id,
      receiptCode: r.receipt_code,
      lat: r.lat,
      lon: r.lon,
      observedAt: r.observed_at,
      intensity: r.intensity,
      screening: r.result_json ? JSON.parse(r.result_json) : null,
    })),
  });
}
