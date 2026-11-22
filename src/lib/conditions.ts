import "server-only";
import { MAP_CENTER } from "./constants";
import { destination, MPH_TO_MS } from "./geo";
import { fetchCurrent } from "./weather";
import { conditionsHint, nearestHour, windAt, type WeatherHour } from "./wind";

export type Conditions = {
  ok: boolean;
  source: string;
  now: WeatherHour | null;
  hint: ReturnType<typeof conditionsHint>;
  next: WeatherHour[];
  error?: string;
};

/** Regional conditions at the map centre: one point, a modelled estimate. */
export async function currentConditions(): Promise<Conditions> {
  const res = await fetchCurrent(MAP_CENTER[0], MAP_CENTER[1]);
  if (!res.ok) return { ok: false, source: res.source, now: null, hint: conditionsHint(null, null), next: [], error: res.error };
  const at = new Date();
  const now = nearestHour(res.hours, at);
  const prev = nearestHour(res.hours, new Date(at.getTime() - 3 * 3_600_000));
  const next = res.hours.filter((h) => Date.parse(h.t) > at.getTime()).slice(0, 6);
  return { ok: !!now, source: res.source, now, hint: conditionsHint(now, prev), next };
}

/**
 * "Where the air may be heading": a forward path from a point using forecast wind.
 * Illustrative only. Odors usually fade well before the end of the path.
 */
export function forwardPath(start: { lat: number; lon: number }, hours: WeatherHour[], from = new Date(), totalH = 2, stepMin = 10) {
  const pts: { lat: number; lon: number; minutes: number }[] = [{ ...start, minutes: 0 }];
  let pos = start;
  for (let m = stepMin; m <= totalH * 60; m += stepMin) {
    const w = windAt(hours, new Date(from.getTime() + (m - stepMin / 2) * 60_000));
    if (!w || w.speedMph < 2) break;
    pos = destination(pos, (w.fromDeg + 180) % 360, w.speedMph * MPH_TO_MS * stepMin * 60);
    pts.push({ lat: pos.lat, lon: pos.lon, minutes: m });
    if (m >= 60 && w.speedMph * (m / 60) > 6) break; // keep it local (~6 miles)
  }
  return pts;
}
