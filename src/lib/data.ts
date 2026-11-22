import "server-only";
import { getDb } from "./db";
import { aggregateCells, dailyStrip, type AggInput } from "./aggregate";
import { distanceM } from "./geo";
import { fetchAround } from "./weather";
import { loadFacilities, runScreening, saveWeather, addTimeline } from "./reports-core";
import type { ScreeningResult } from "./screening";
import type { WeatherHour } from "./wind";

const db = () => getDb();
const parse = <T,>(s: unknown, fallback: T): T => {
  try {
    return typeof s === "string" ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
};

// ---------------------------------------------------------------- public

export function publicFacilities() {
  return loadFacilities(db(), true).map((f) => ({ id: f.id, name: f.name, type: f.type, lat: f.lat, lon: f.lon, approx: !!f.approx }));
}

function aggRows(fromIso: string, toIso: string): AggInput[] {
  const rows = db()
    .prepare("SELECT lat,lon,intensity,characters,observed_at FROM reports WHERE observed_at >= ? AND observed_at <= ?")
    .all(fromIso, toIso) as { lat: number; lon: number; intensity: number; characters: string; observed_at: string }[];
  return rows.map((r) => ({ lat: r.lat, lon: r.lon, intensity: r.intensity, characters: parse(r.characters, []), observedAt: r.observed_at }));
}

/** Aggregated, k-anonymous view for the public map. Never returns raw coordinates or free text. */
export function publicAggregate(from: Date, to: Date) {
  const { cells, hiddenCount, total } = aggregateCells(aggRows(from.toISOString(), to.toISOString()));
  const now = new Date();
  const strip = dailyStrip(aggRows(new Date(now.getTime() - 31 * 86_400_000).toISOString(), now.toISOString()), 30, now);
  return { cells, hiddenCount, total, strip, facilities: publicFacilities(), from: from.toISOString(), to: to.toISOString() };
}

export function publishedUpdates(limit = 5) {
  return db()
    .prepare(
      `SELECT r.receipt_code, r.observed_at, r.cell_id, p.body, p.published_at FROM responses p JOIN reports r ON r.id=p.report_id
       WHERE p.status='published' ORDER BY p.published_at DESC LIMIT ?`,
    )
    .all(limit) as { receipt_code: string; observed_at: string; body: string; published_at: string }[];
}

export function publicStats() {
  const d = db();
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const week = (d.prepare("SELECT COUNT(*) n FROM reports WHERE observed_at>=?").get(since7) as { n: number }).n;
  const responded = (d.prepare("SELECT COUNT(*) n FROM reports WHERE status IN ('responded','closed')").get() as { n: number }).n;
  const total = (d.prepare("SELECT COUNT(*) n FROM reports").get() as { n: number }).n;
  return { week, responded, total };
}

export type ResidentReportView = {
  id: number;
  receiptCode: string;
  observedAt: string;
  createdAt: string;
  intensity: number;
  characters: string[];
  characterOther: string | null;
  duration: string;
  ongoing: boolean;
  symptoms: string[];
  suspectedSource: string | null;
  notes: string | null;
  status: string;
  weather: { status: string; speedMph: number | null; fromDeg: number | null; tempF: number | null; sampleTime: string | null };
  timeline: { type: string; message: string; at: string }[];
  responses: { body: string; publishedAt: string }[];
};

function residentView(r: Record<string, unknown>): ResidentReportView {
  const d = db();
  const id = r.id as number;
  const w = d.prepare("SELECT fetch_status,wind_speed_mph,wind_from_deg,temp_f,sample_time FROM weather_snapshots WHERE report_id=?").get(id) as
    | Record<string, unknown>
    | undefined;
  return {
    id,
    receiptCode: r.receipt_code as string,
    observedAt: r.observed_at as string,
    createdAt: r.created_at as string,
    intensity: r.intensity as number,
    characters: parse(r.characters, []),
    characterOther: (r.character_other as string) ?? null,
    duration: r.duration as string,
    ongoing: !!r.ongoing,
    symptoms: parse(r.symptoms, []),
    suspectedSource: (r.suspected_source as string) ?? null,
    notes: (r.notes as string) ?? null,
    status: r.status as string,
    weather: {
      status: (w?.fetch_status as string) ?? "pending",
      speedMph: (w?.wind_speed_mph as number) ?? null,
      fromDeg: (w?.wind_from_deg as number) ?? null,
      tempF: (w?.temp_f as number) ?? null,
      sampleTime: (w?.sample_time as string) ?? null,
    },
    // Only events marked public. Internal investigation notes never reach residents.
    timeline: d.prepare("SELECT type,message,at FROM timeline_events WHERE report_id=? AND is_public=1 ORDER BY at").all(id).map((x) => ({ ...x })) as never,
    responses: d
      .prepare("SELECT body, published_at AS publishedAt FROM responses WHERE report_id=? AND status='published' ORDER BY published_at")
      .all(id).map((x) => ({ ...x })) as never,
  };
}

export function reportByReceipt(code: string) {
  const r = db().prepare("SELECT * FROM reports WHERE receipt_code=?").get(code) as Record<string, unknown> | undefined;
  return r ? residentView(r) : null;
}

export function reportsForUser(userId: number) {
  const rows = db().prepare("SELECT * FROM reports WHERE user_id=? ORDER BY observed_at DESC").all(userId) as Record<string, unknown>[];
  return rows.map(residentView);
}

/** Retry weather for a report whose retrieval failed or is pending, then re-screen. */
export async function ensureWeather(reportId: number, maxAttempts = 5) {
  const d = db();
  const w = d.prepare("SELECT fetch_status,attempts FROM weather_snapshots WHERE report_id=?").get(reportId) as
    | { fetch_status: string; attempts: number }
    | undefined;
  if (!w || w.fetch_status === "ok" || w.attempts >= maxAttempts) return false;
  const r = d.prepare("SELECT lat,lon,observed_at FROM reports WHERE id=?").get(reportId) as { lat: number; lon: number; observed_at: string };
  const at = new Date(r.observed_at);
  const res = await fetchAround(r.lat, r.lon, at);
  saveWeather(d, reportId, at, res);
  runScreening(d, reportId);
  return res.ok;
}

// ---------------------------------------------------------------- staff

export type StaffFilters = { status?: string; minIntensity?: number; days?: number; q?: string };

export function staffReportList(f: StaffFilters = {}) {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (f.status && f.status !== "all") {
    if (f.status === "open") where.push("r.status IN ('received','under_review','investigating')");
    else {
      where.push("r.status=?");
      args.push(f.status);
    }
  }
  if (f.minIntensity) {
    where.push("r.intensity>=?");
    args.push(f.minIntensity);
  }
  if (f.days) {
    where.push("r.observed_at>=?");
    args.push(new Date(Date.now() - f.days * 86_400_000).toISOString());
  }
  if (f.q) {
    where.push("(r.receipt_code LIKE ? OR r.characters LIKE ? OR r.suspected_source LIKE ?)");
    args.push(`%${f.q}%`, `%${f.q}%`, `%${f.q}%`);
  }
  const rows = db()
    .prepare(
      `SELECT r.id,r.receipt_code,r.lat,r.lon,r.observed_at,r.created_at,r.intensity,r.characters,r.status,r.duration,
         w.fetch_status, w.wind_speed_mph, w.wind_from_deg, s.verdict, s.result_json
       FROM reports r LEFT JOIN weather_snapshots w ON w.report_id=r.id LEFT JOIN screening_results s ON s.report_id=r.id
       ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY r.observed_at DESC LIMIT 500`,
    )
    .all(...args) as Record<string, unknown>[];
  return rows.map((r) => {
    const s = parse<ScreeningResult | null>(r.result_json, null);
    return {
      id: r.id as number,
      receiptCode: r.receipt_code as string,
      lat: r.lat as number,
      lon: r.lon as number,
      observedAt: r.observed_at as string,
      createdAt: r.created_at as string,
      intensity: r.intensity as number,
      characters: parse<string[]>(r.characters, []),
      status: r.status as string,
      duration: r.duration as string,
      weatherStatus: (r.fetch_status as string) ?? "pending",
      windSpeedMph: (r.wind_speed_mph as number) ?? null,
      windFromDeg: (r.wind_from_deg as number) ?? null,
      verdict: (r.verdict as string) ?? null,
      topCandidate: s?.candidates[0]?.name ?? null,
      candidateCount: s?.candidates.filter((c) => c.level !== "nearby").length ?? 0,
    };
  });
}
export type StaffReportRow = ReturnType<typeof staffReportList>[number];

export function staffReportDetail(id: number) {
  const d = db();
  const r = d.prepare("SELECT * FROM reports WHERE id=?").get(id) as Record<string, unknown> | undefined;
  if (!r) return null;
  const w = d.prepare("SELECT * FROM weather_snapshots WHERE report_id=?").get(id) as Record<string, unknown> | undefined;
  const s = d.prepare("SELECT * FROM screening_results WHERE report_id=?").get(id) as Record<string, unknown> | undefined;
  const entries = d
    .prepare(
      `SELECT e.*, u.name AS author FROM investigation_entries e LEFT JOIN users u ON u.id=e.author_id WHERE report_id=? ORDER BY observed_at`,
    )
    .all(id) as Record<string, unknown>[];
  const responses = d
    .prepare(
      `SELECT p.*, a.name AS author, v.name AS reviewer FROM responses p LEFT JOIN users a ON a.id=p.author_id LEFT JOIN users v ON v.id=p.reviewed_by
       WHERE report_id=? ORDER BY created_at`,
    )
    .all(id) as Record<string, unknown>[];
  const timeline = d.prepare("SELECT * FROM timeline_events WHERE report_id=? ORDER BY at").all(id) as Record<string, unknown>[];
  // Nearby reports within ±3 h and 4 km: helps corroborate.
  const t = new Date(r.observed_at as string).getTime();
  const nearby = (
    d
      .prepare("SELECT id,receipt_code,lat,lon,observed_at,intensity FROM reports WHERE id<>? AND observed_at BETWEEN ? AND ?")
      .all(id, new Date(t - 3 * 3_600_000).toISOString(), new Date(t + 3 * 3_600_000).toISOString()) as {
      id: number;
      receipt_code: string;
      lat: number;
      lon: number;
      observed_at: string;
      intensity: number;
    }[]
  ).filter((n) => distanceM(n, { lat: r.lat as number, lon: r.lon as number }) <= 4000);

  return {
    report: {
      id,
      receiptCode: r.receipt_code as string,
      lat: r.lat as number,
      lon: r.lon as number,
      locationMethod: r.location_method as string,
      observedAt: r.observed_at as string,
      createdAt: r.created_at as string,
      intensity: r.intensity as number,
      characters: parse<string[]>(r.characters, []),
      characterOther: (r.character_other as string) ?? null,
      duration: r.duration as string,
      ongoing: !!r.ongoing,
      symptoms: parse<string[]>(r.symptoms, []),
      suspectedSource: (r.suspected_source as string) ?? null,
      notes: (r.notes as string) ?? null,
      contact: r.consent_contact
        ? { name: r.contact_name as string | null, phone: r.contact_phone as string | null, email: r.contact_email as string | null }
        : null,
      status: r.status as string,
    },
    weather: w
      ? {
          status: w.fetch_status as string,
          source: w.source as string | null,
          error: w.error as string | null,
          attempts: w.attempts as number,
          sampleTime: w.sample_time as string | null,
          speedMph: w.wind_speed_mph as number | null,
          fromDeg: w.wind_from_deg as number | null,
          gustMph: w.gust_mph as number | null,
          tempF: w.temp_f as number | null,
          rh: w.rh as number | null,
          pressureHpa: w.pressure_hpa as number | null,
          cloudCover: w.cloud_cover as number | null,
          precipIn: w.precip_in as number | null,
          blhM: w.blh_m as number | null,
          hours: parse<WeatherHour[]>(w.hours_json, []),
        }
      : null,
    screening: s ? { computedAt: s.computed_at as string, result: parse<ScreeningResult | null>(s.result_json, null) } : null,
    entries: entries.map((e) => ({
      id: e.id as number,
      kind: e.kind as string,
      author: (e.author as string) ?? "Staff",
      observedAt: e.observed_at as string,
      locationText: (e.location_text as string) ?? null,
      odorDetected: e.odor_detected == null ? null : !!e.odor_detected,
      intensity: (e.intensity as number) ?? null,
      character: (e.character as string) ?? null,
      windText: (e.wind_text as string) ?? null,
      notes: e.notes as string,
    })),
    responses: responses.map((p) => ({
      id: p.id as number,
      body: p.body as string,
      status: p.status as string,
      author: (p.author as string) ?? null,
      reviewer: (p.reviewer as string) ?? null,
      createdAt: p.created_at as string,
      publishedAt: (p.published_at as string) ?? null,
    })),
    timeline: timeline.map((e) => ({ type: e.type as string, message: e.message as string, at: e.at as string, isPublic: !!e.is_public })),
    nearby,
    facilities: loadFacilities(d),
  };
}
export type StaffReportDetail = NonNullable<ReturnType<typeof staffReportDetail>>;

export function staffKpis() {
  const d = db();
  const since24 = new Date(Date.now() - 86_400_000).toISOString();
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const n = (sql: string, ...a: string[]) => (d.prepare(sql).get(...a) as { n: number }).n;
  const firstResp = d
    .prepare(
      `SELECT r.created_at, MIN(t.at) AS first_at FROM reports r JOIN timeline_events t ON t.report_id=r.id AND t.type<>'received' AND t.is_public=1
       WHERE r.created_at>=? GROUP BY r.id`,
    )
    .all(new Date(Date.now() - 30 * 86_400_000).toISOString()) as { created_at: string; first_at: string }[];
  const hrs = firstResp.map((x) => (Date.parse(x.first_at) - Date.parse(x.created_at)) / 3_600_000).sort((a, b) => a - b);
  const medianHrs = hrs.length ? hrs[Math.floor(hrs.length / 2)] : null;
  return {
    last24: n("SELECT COUNT(*) n FROM reports WHERE observed_at>=?", since24),
    newUnreviewed: n("SELECT COUNT(*) n FROM reports WHERE status='received'"),
    investigating: n("SELECT COUNT(*) n FROM reports WHERE status IN ('under_review','investigating')"),
    drafts: n("SELECT COUNT(*) n FROM responses WHERE status='draft'"),
    week: n("SELECT COUNT(*) n FROM reports WHERE observed_at>=?", since7),
    weatherFailed: n("SELECT COUNT(*) n FROM weather_snapshots WHERE fetch_status<>'ok'"),
    medianFirstResponseHrs: medianHrs,
  };
}

/** Crowd-triggered alert: ≥3 reports with intensity ≥3 within 60 min and 2 km (in the last 24 h). */
export function clusterAlerts(hours = 24) {
  const rows = db()
    .prepare("SELECT id,receipt_code,lat,lon,observed_at,intensity FROM reports WHERE observed_at>=? AND intensity>=3 ORDER BY observed_at")
    .all(new Date(Date.now() - hours * 3_600_000).toISOString()) as {
    id: number;
    receipt_code: string;
    lat: number;
    lon: number;
    observed_at: string;
    intensity: number;
  }[];
  const used = new Set<number>();
  const alerts: { ids: number[]; start: string; end: string; center: { lat: number; lon: number }; maxIntensity: number }[] = [];
  for (const a of rows) {
    if (used.has(a.id)) continue;
    const group = rows.filter(
      (b) => !used.has(b.id) && Math.abs(Date.parse(b.observed_at) - Date.parse(a.observed_at)) <= 60 * 60_000 && distanceM(a, b) <= 2000,
    );
    if (group.length >= 3) {
      group.forEach((g) => used.add(g.id));
      alerts.push({
        ids: group.map((g) => g.id),
        start: group[0].observed_at,
        end: group[group.length - 1].observed_at,
        center: { lat: group.reduce((s, g) => s + g.lat, 0) / group.length, lon: group.reduce((s, g) => s + g.lon, 0) / group.length },
        maxIntensity: Math.max(...group.map((g) => g.intensity)),
      });
    }
  }
  return alerts.reverse();
}

export function allFacilities() {
  return loadFacilities(db());
}

export function exportRows() {
  return db()
    .prepare(
      `SELECT r.receipt_code, r.observed_at, r.created_at, r.lat, r.lon, r.intensity, r.characters, r.character_other, r.duration, r.ongoing,
         r.symptoms, r.suspected_source, r.status, w.fetch_status AS weather_status, w.source AS weather_source, w.sample_time,
         w.wind_speed_mph, w.wind_from_deg, w.temp_f, w.rh, w.pressure_hpa, w.cloud_cover, w.precip_in, w.blh_m, s.verdict, s.result_json
       FROM reports r LEFT JOIN weather_snapshots w ON w.report_id=r.id LEFT JOIN screening_results s ON s.report_id=r.id ORDER BY r.observed_at`,
    )
    .all() as Record<string, unknown>[];
}

export { addTimeline };
