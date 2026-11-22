// Open-Meteo client (free, no key, CC-BY 4.0, https://open-meteo.com).
// All values are MODEL ESTIMATES on a grid of about 3 km, not on-site measurements.
import type { WeatherHour } from "./wind";

const FORECAST = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const VARS = [
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "temperature_2m",
  "relative_humidity_2m",
  "pressure_msl",
  "cloud_cover",
  "precipitation",
  "boundary_layer_height",
];

export type WeatherFetch =
  | { ok: true; source: string; hours: WeatherHour[] }
  | { ok: false; source: string; error: string };

const cache = new Map<string, { at: number; value: WeatherFetch }>();
const CACHE_MS = 15 * 60_000;

const ymd = (d: Date) => d.toISOString().slice(0, 10);

type OMHourly = Record<string, (number | null)[]> & { time: number[] };

function parseHourly(h: OMHourly): WeatherHour[] {
  const col = (k: string, i: number) => (h[k] ? (h[k][i] ?? null) : null);
  return h.time.map((ts, i) => ({
    t: new Date(ts * 1000).toISOString(),
    windSpeedMph: col("wind_speed_10m", i),
    windFromDeg: col("wind_direction_10m", i),
    gustMph: col("wind_gusts_10m", i),
    tempF: col("temperature_2m", i),
    rh: col("relative_humidity_2m", i),
    pressureHpa: col("pressure_msl", i),
    cloudCover: col("cloud_cover", i),
    precipIn: col("precipitation", i),
    blhM: col("boundary_layer_height", i),
  }));
}

async function request(base: string, params: Record<string, string>, timeoutMs: number) {
  const url = `${base}?${new URLSearchParams(params)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.reason ?? `HTTP ${res.status}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Hourly weather for one point between two instants (inclusive, whole UTC days).
 * Uses the forecast API (which also serves the last ~90 days) or the archive for older dates.
 * One retry; when boundary-layer height isn't available it retries without it.
 */
async function fetchOpenMeteo(
  lat: number,
  lon: number,
  from: Date,
  to: Date,
  opts: { timeoutMs?: number } = {},
): Promise<WeatherFetch> {
  const ageDays = (Date.now() - from.getTime()) / 86_400_000;
  const useArchive = ageDays > 85;
  const base = useArchive ? ARCHIVE : FORECAST;
  const source = useArchive ? "open-meteo:archive" : "open-meteo:forecast";
  const key = `${base}|${lat.toFixed(2)}|${lon.toFixed(2)}|${ymd(from)}|${ymd(to)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const params = (vars: string[]) => ({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    hourly: vars.join(","),
    start_date: ymd(from),
    end_date: ymd(to),
    wind_speed_unit: "mph",
    temperature_unit: "fahrenheit",
    precipitation_unit: "inch",
    timeformat: "unixtime",
    timezone: "GMT",
  });

  let lastErr = "unknown error";
  let vars = VARS;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const body = await request(base, params(vars), opts.timeoutMs ?? 8000);
      const value: WeatherFetch = { ok: true, source, hours: parseHourly(body.hourly) };
      cache.set(key, { at: Date.now(), value });
      return value;
    } catch (e) {
      const cause = (e as { cause?: { code?: string; message?: string } })?.cause;
      lastErr = (e instanceof Error ? e.message : String(e)) + (cause ? ` (${cause.code ?? cause.message})` : "");
      if (/boundary_layer_height/i.test(lastErr)) vars = VARS.filter((v) => v !== "boundary_layer_height");
      else if (/limit exceeded/i.test(lastErr)) {
        openMeteoBlockedUntil = Date.now() + 60 * 60_000; // don't hammer it for an hour
        break;
      } else if (attempt >= 1) break;
    }
  }
  return { ok: false, source, error: lastErr };
}

let openMeteoBlockedUntil = 0;

// ---------- Fallback: US National Weather Service (free, no key) ----------
// Real observations from McKinney National Airport (KTKI), about 20 km SW of Melissa.
// Covers roughly the last 7 days; no forecast hours.
const NWS_STATION = "KTKI";
const kmhToMph = (v: number | null) => (v == null ? null : Math.round(v * 0.621371 * 10) / 10);

type NwsVal = { value: number | null } | undefined;
type NwsObs = {
  properties: {
    timestamp: string;
    windDirection?: NwsVal;
    windSpeed?: NwsVal;
    windGust?: NwsVal;
    temperature?: NwsVal;
    relativeHumidity?: NwsVal;
    barometricPressure?: NwsVal;
    precipitationLastHour?: NwsVal;
  };
};

async function fetchNws(from: Date, to: Date): Promise<WeatherFetch> {
  const source = `nws:${NWS_STATION}`;
  const key = `nws|${from.toISOString().slice(0, 13)}|${to.toISOString().slice(0, 13)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const end = new Date(Math.min(to.getTime(), Date.now()));
  const url = `https://api.weather.gov/stations/${NWS_STATION}/observations?start=${from.toISOString()}&end=${end.toISOString()}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Aeris-community-odor-prototype/0.1", Accept: "application/geo+json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { features: NwsObs[] };
    const hours: WeatherHour[] = body.features
      .map(({ properties: p }) => {
        const speed = kmhToMph(p.windSpeed?.value ?? null);
        const dir = p.windDirection?.value ?? null;
        const precipMm = p.precipitationLastHour?.value ?? null;
        return {
          t: new Date(p.timestamp).toISOString(),
          windSpeedMph: speed,
          // Calm is reported as speed 0 with no direction; keep it so screening sees "calm".
          windFromDeg: dir ?? (speed === 0 ? 0 : null),
          gustMph: kmhToMph(p.windGust?.value ?? null),
          tempF: p.temperature?.value == null ? null : Math.round((p.temperature.value * 9) / 5 + 32),
          rh: p.relativeHumidity?.value ?? null,
          pressureHpa: p.barometricPressure?.value == null ? null : p.barometricPressure.value / 100,
          cloudCover: null,
          precipIn: precipMm == null ? null : Math.round((precipMm / 25.4) * 100) / 100,
          blhM: null,
        };
      })
      .filter((h) => h.windSpeedMph != null)
      .sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
    if (!hours.length) throw new Error("No observations for that time (station keeps about 7 days)");
    const value: WeatherFetch = { ok: true, source, hours };
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (e) {
    return { ok: false, source, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Hourly weather for one point. Tries Open-Meteo first (model data, includes forecast);
 * if it is unavailable (e.g. the shared daily limit on free hosting), falls back to
 * National Weather Service station observations.
 */
export async function fetchHourly(lat: number, lon: number, from: Date, to: Date, opts: { timeoutMs?: number } = {}): Promise<WeatherFetch> {
  let om: WeatherFetch | null = null;
  if (Date.now() >= openMeteoBlockedUntil) {
    om = await fetchOpenMeteo(lat, lon, from, to, opts);
    if (om.ok) return om;
  }
  if (Date.now() - from.getTime() < 8 * 86_400_000) {
    const nws = await fetchNws(from, to);
    if (nws.ok) return nws;
    return { ok: false, source: "open-meteo+nws", error: `${om ? om.error : "Open-Meteo paused (limit)"}; NWS: ${nws.error}` };
  }
  return om ?? { ok: false, source: "open-meteo", error: "Open-Meteo paused after hitting its daily limit" };
}

/** Weather around an observation: from 4 h before to 2 h after. */
export function fetchAround(lat: number, lon: number, at: Date) {
  return fetchHourly(lat, lon, new Date(at.getTime() - 4 * 3_600_000), new Date(at.getTime() + 2 * 3_600_000));
}

/** Current conditions plus the next few forecast hours (used for the public wind card and forward path). */
export async function fetchCurrent(lat: number, lon: number) {
  const now = new Date();
  return fetchHourly(lat, lon, new Date(now.getTime() - 6 * 3_600_000), new Date(now.getTime() + 6 * 3_600_000));
}

