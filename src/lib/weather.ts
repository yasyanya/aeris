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
export async function fetchHourly(
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
      const body = await request(base, params(vars), opts.timeoutMs ?? 5000);
      const value: WeatherFetch = { ok: true, source, hours: parseHourly(body.hourly) };
      cache.set(key, { at: Date.now(), value });
      return value;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      if (/boundary_layer_height/i.test(lastErr)) vars = VARS.filter((v) => v !== "boundary_layer_height");
      else if (attempt >= 1) break;
    }
  }
  return { ok: false, source, error: lastErr };
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

