import { currentUser, isStaff } from "@/lib/auth";
import { exportRows } from "@/lib/data";
import type { ScreeningResult } from "@/lib/screening";

const esc = (v: unknown) => {
  if (v == null) return "";
  const s = String(v);
  // Neutralise spreadsheet formula injection and quote as needed.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function GET() {
  const u = await currentUser();
  if (!u || !isStaff(u.role)) return new Response("Unauthorized", { status: 401 });
  const rows = exportRows();
  const cols = [
    "receipt_code", "observed_at_utc", "created_at_utc", "lat", "lon", "intensity_0_5", "characters", "character_other", "duration",
    "ongoing", "symptoms", "suspected_source", "status", "weather_status", "weather_source", "weather_sample_utc", "wind_speed_mph",
    "wind_from_deg", "temp_f", "rh_pct", "pressure_hpa", "cloud_cover_pct", "precip_in", "boundary_layer_m", "screen_verdict",
    "screen_candidates",
  ];
  const lines = [cols.join(",")];
  for (const r of rows) {
    let cands = "";
    try {
      const s = JSON.parse(String(r.result_json ?? "null")) as ScreeningResult | null;
      cands = s?.candidates.map((c) => `${c.name} (${c.level})`).join("; ") ?? "";
    } catch {}
    lines.push(
      [
        r.receipt_code, r.observed_at, r.created_at, r.lat, r.lon, r.intensity, JSON.parse(String(r.characters)).join("|"), r.character_other,
        r.duration, r.ongoing ? "yes" : "no", JSON.parse(String(r.symptoms)).join("|"), r.suspected_source, r.status, r.weather_status,
        r.weather_source, r.sample_time, r.wind_speed_mph, r.wind_from_deg, r.temp_f, r.rh, r.pressure_hpa, r.cloud_cover, r.precip_in,
        r.blh_m, r.verdict, cands,
      ]
        .map(esc)
        .join(","),
    );
  }
  const date = new Date().toISOString().slice(0, 10);
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="aeris-odor-reports-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
