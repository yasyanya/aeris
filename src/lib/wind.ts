// Pure helpers for working with hourly weather series. No network access here.
import { uvToWind, windToUV } from "./geo";

export type WeatherHour = {
  /** ISO timestamp (UTC) at the start of the hour */
  t: string;
  windSpeedMph: number | null;
  /** Direction the wind blows FROM, degrees clockwise from north */
  windFromDeg: number | null;
  gustMph: number | null;
  tempF: number | null;
  rh: number | null;
  pressureHpa: number | null;
  cloudCover: number | null;
  precipIn: number | null;
  blhM: number | null;
};

export type WindSample = { speedMph: number; fromDeg: number };

/**
 * Wind at an arbitrary instant, linearly interpolated between the two
 * surrounding hours as u/v vectors, so 350° and 10° average to 0°, not 180°.
 */
export function windAt(hours: WeatherHour[], at: Date): WindSample | null {
  const t = at.getTime();
  const valid = hours
    .filter((h) => h.windSpeedMph != null && h.windFromDeg != null)
    .map((h) => ({ ms: Date.parse(h.t), s: h.windSpeedMph!, d: h.windFromDeg! }))
    .sort((a, b) => a.ms - b.ms);
  if (!valid.length) return null;
  if (t <= valid[0].ms) return valid[0].ms - t <= 90 * 60_000 ? { speedMph: valid[0].s, fromDeg: valid[0].d } : null;
  const last = valid[valid.length - 1];
  if (t >= last.ms) return t - last.ms <= 90 * 60_000 ? { speedMph: last.s, fromDeg: last.d } : null;
  for (let i = 0; i < valid.length - 1; i++) {
    const a = valid[i];
    const b = valid[i + 1];
    if (t >= a.ms && t <= b.ms) {
      if (b.ms - a.ms > 3 * 3_600_000) return null; // gap too large to interpolate across
      const f = (t - a.ms) / (b.ms - a.ms);
      const ua = windToUV(a.s, a.d);
      const ub = windToUV(b.s, b.d);
      const w = uvToWind(ua.u + (ub.u - ua.u) * f, ua.v + (ub.v - ua.v) * f);
      return { speedMph: w.speed, fromDeg: w.fromDeg };
    }
  }
  return null;
}

/** The hour whose timestamp is closest to `at` (within 90 minutes). */
export function nearestHour(hours: WeatherHour[], at: Date): WeatherHour | null {
  let best: WeatherHour | null = null;
  let bestDiff = Infinity;
  for (const h of hours) {
    const d = Math.abs(Date.parse(h.t) - at.getTime());
    if (d < bestDiff) {
      best = h;
      bestDiff = d;
    }
  }
  return best && bestDiff <= 90 * 60_000 ? best : null;
}

/** Hours within [at - before, at + after]. */
export function hoursAround(hours: WeatherHour[], at: Date, beforeH: number, afterH: number) {
  const t = at.getTime();
  return hours.filter((h) => {
    const ms = Date.parse(h.t);
    return ms >= t - beforeH * 3_600_000 - 1 && ms <= t + afterH * 3_600_000 + 1;
  });
}

/**
 * Rough "odor-favourable conditions" hint: calm/light wind, low mixing height
 * (a proxy for inversions) and falling pressure, which NTMWD says make odors worse.
 */
export function conditionsHint(now: WeatherHour | null, prev3h: WeatherHour | null) {
  if (!now || now.windSpeedMph == null) return { level: "unknown" as const, reasons: ["Weather data unavailable"] };
  const reasons: string[] = [];
  let score = 0;
  if (now.windSpeedMph < 3) {
    score += 2;
    reasons.push("Calm or very light wind lets odors linger");
  } else if (now.windSpeedMph < 7) {
    score += 1;
    reasons.push("Light wind");
  }
  if (now.blhM != null && now.blhM < 300) {
    score += 2;
    reasons.push("Shallow mixing layer (inversion-like conditions)");
  }
  if (now.pressureHpa != null && prev3h?.pressureHpa != null && now.pressureHpa - prev3h.pressureHpa <= -1) {
    score += 1;
    reasons.push("Falling air pressure");
  }
  if (now.precipIn != null && now.precipIn > 0) {
    score += 1;
    reasons.push("Recent rain");
  }
  const level = score >= 3 ? ("elevated" as const) : score >= 1 ? ("moderate" as const) : ("low" as const);
  if (!reasons.length) reasons.push("Steady breeze helps odors disperse");
  return { level, reasons };
}
