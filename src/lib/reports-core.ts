// Report persistence helpers shared by the app and the seed script.
import type { DatabaseSync } from "node:sqlite";
import { HEX_SIZE_M } from "./constants";
import { hexCellId } from "./geo";
import { newReceiptCode } from "./receipt";
import { screenSources, type Facility, type ScreeningResult } from "./screening";
import { hoursAround, nearestHour, type WeatherHour } from "./wind";
import type { WeatherFetch } from "./weather";

export type NewReport = {
  userId: number | null;
  lat: number;
  lon: number;
  locationMethod: "device" | "pin" | "search";
  observedAt: string;
  intensity: number;
  characters: string[];
  characterOther?: string | null;
  duration: string;
  ongoing: boolean;
  symptoms: string[];
  suspectedSource?: string | null;
  notes?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  consentContact: boolean;
  createdAt?: string;
  status?: string;
};

export function insertReport(db: DatabaseSync, r: NewReport): { id: number; receiptCode: string } {
  const createdAt = r.createdAt ?? new Date().toISOString();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newReceiptCode();
    try {
      const res = db
        .prepare(
          `INSERT INTO reports (receipt_code,user_id,lat,lon,location_method,cell_id,observed_at,intensity,characters,character_other,
            duration,ongoing,symptoms,suspected_source,notes,contact_name,contact_phone,contact_email,consent_contact,status,created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          code,
          r.userId,
          r.lat,
          r.lon,
          r.locationMethod,
          hexCellId(r, HEX_SIZE_M),
          r.observedAt,
          r.intensity,
          JSON.stringify(r.characters),
          r.characterOther ?? null,
          r.duration,
          r.ongoing ? 1 : 0,
          JSON.stringify(r.symptoms),
          r.suspectedSource ?? null,
          r.notes ?? null,
          r.consentContact ? (r.contactName ?? null) : null,
          r.consentContact ? (r.contactPhone ?? null) : null,
          r.consentContact ? (r.contactEmail ?? null) : null,
          r.consentContact ? 1 : 0,
          r.status ?? "received",
          createdAt,
        );
      const id = Number(res.lastInsertRowid);
      addTimeline(db, id, "received", "Report received. Thank you, your observation is saved.", true, createdAt);
      db.prepare("INSERT INTO weather_snapshots (report_id, fetch_status) VALUES (?, 'pending')").run(id);
      return { id, receiptCode: code };
    } catch (e) {
      if (!(e instanceof Error) || !/UNIQUE/.test(e.message)) throw e;
    }
  }
  throw new Error("Could not allocate a receipt code");
}

export function addTimeline(db: DatabaseSync, reportId: number, type: string, message: string, isPublic: boolean, at?: string) {
  db.prepare("INSERT INTO timeline_events (report_id,type,is_public,message,at) VALUES (?,?,?,?,?)").run(
    reportId,
    type,
    isPublic ? 1 : 0,
    message,
    at ?? new Date().toISOString(),
  );
}

export function saveWeather(db: DatabaseSync, reportId: number, observedAt: Date, w: WeatherFetch) {
  const now = new Date().toISOString();
  if (!w.ok) {
    db.prepare(
      "UPDATE weather_snapshots SET fetch_status='failed', source=?, error=?, attempts=attempts+1, fetched_at=? WHERE report_id=?",
    ).run(w.source, w.error.slice(0, 300), now, reportId);
    return;
  }
  const around = hoursAround(w.hours, observedAt, 4, 2);
  const h = nearestHour(around, observedAt);
  db.prepare(
    `UPDATE weather_snapshots SET fetch_status=?, source=?, sample_time=?, wind_speed_mph=?, wind_from_deg=?, gust_mph=?, temp_f=?, rh=?,
       pressure_hpa=?, cloud_cover=?, precip_in=?, blh_m=?, hours_json=?, error=NULL, attempts=attempts+1, fetched_at=? WHERE report_id=?`,
  ).run(
    h ? "ok" : "failed",
    w.source,
    h?.t ?? null,
    h?.windSpeedMph ?? null,
    h?.windFromDeg ?? null,
    h?.gustMph ?? null,
    h?.tempF ?? null,
    h?.rh ?? null,
    h?.pressureHpa ?? null,
    h?.cloudCover ?? null,
    h?.precipIn ?? null,
    h?.blhM ?? null,
    JSON.stringify(around),
    now,
    reportId,
  );
}

export function loadFacilities(db: DatabaseSync, onlyPublic = false): (Facility & { is_public: number; operator: string | null; approx: number; notes: string | null })[] {
  // node:sqlite rows have a null prototype; copy into plain objects so they can cross to client components.
  return db
    .prepare(`SELECT id,name,operator,type,lat,lon,is_public,approx,notes FROM facilities ${onlyPublic ? "WHERE is_public=1" : ""} ORDER BY id`)
    .all()
    .map((r) => ({ ...r })) as never;
}

export function runScreening(db: DatabaseSync, reportId: number): ScreeningResult {
  const r = db.prepare("SELECT lat,lon,observed_at FROM reports WHERE id=?").get(reportId) as {
    lat: number;
    lon: number;
    observed_at: string;
  };
  const w = db.prepare("SELECT fetch_status,hours_json FROM weather_snapshots WHERE report_id=?").get(reportId) as
    | { fetch_status: string; hours_json: string | null }
    | undefined;
  const hours: WeatherHour[] | null = w?.fetch_status === "ok" && w.hours_json ? JSON.parse(w.hours_json) : null;
  const result = screenSources({ lat: r.lat, lon: r.lon }, new Date(r.observed_at), hours, loadFacilities(db));
  db.prepare(
    `INSERT INTO screening_results (report_id,computed_at,verdict,result_json) VALUES (?,?,?,?)
     ON CONFLICT(report_id) DO UPDATE SET computed_at=excluded.computed_at, verdict=excluded.verdict, result_json=excluded.result_json`,
  ).run(reportId, new Date().toISOString(), result.verdict, JSON.stringify(result));
  return result;
}
