// Explainable source screening. Deterministic rules, no machine learning.
//
// 1. Upwind-cone test: a facility is a candidate when the bearing from the
//    observer to the facility lies within ±tolerance of the direction the wind
//    blows FROM, and it is within MAX_DISTANCE.
// 2. Simple back-trajectory: step the air parcel backwards in time from the
//    observer using hourly wind (interpolated), and flag facilities near the path.
//    This is the piecewise "straight-line" approach several state agencies use
//    for odor complaints. It is not a full HYSPLIT dispersion model.
// Calm wind, unstable direction, or missing weather produce an INCONCLUSIVE result.

import { angleDiff, bearingDeg, compass, destination, distanceM, maxBearingSpread, MPH_TO_MS, type LatLon } from "./geo";
import { hoursAround, windAt, type WeatherHour } from "./wind";

export const SCREENING = {
  CALM_MPH: 2, // NWS ASOS reports ≤ 2 kt (~2.3 mph) as calm
  LIGHT_MPH: 5,
  BASE_TOL: 22.5,
  WIDE_TOL: 35,
  VARIABLE_SPREAD: 60, // METAR "variable" when direction swings ≥ 60°
  MAX_DISTANCE_M: 8000,
  CALM_NEARBY_M: 3000,
  TRAJ_HOURS: 3,
  TRAJ_STEP_MIN: 10,
  TRAJ_HIT_M: 750,
  INDISTINGUISHABLE_DEG: 15,
} as const;

export type Facility = { id: number; name: string; type: string; lat: number; lon: number };

export type TrajectoryPoint = { lat: number; lon: number; minutesBefore: number };

export type Candidate = {
  facilityId: number;
  name: string;
  distanceM: number;
  bearingFromObserver: number;
  angleOffWind: number;
  inCone: boolean;
  trajectoryHit: boolean;
  trajectoryMissM: number | null;
  level: "stronger" | "possible" | "nearby";
  reasons: string[];
};

export type ScreeningResult = {
  verdict: "candidates" | "none_fit" | "inconclusive";
  headline: string;
  wind: { speedMph: number; fromDeg: number; compass: string } | null;
  toleranceDeg: number | null;
  candidates: Candidate[];
  indistinguishable: number[][];
  trajectory: TrajectoryPoint[];
  assumptions: string[];
  missing: string[];
  inconclusiveReasons: string[];
};

const BASE_ASSUMPTIONS = [
  "Wind is a modelled 10 m estimate on a ~3 km grid (Open-Meteo) or, as a backup, readings from the McKinney airport station about 20 km away. Neither is an on-site measurement.",
  "Terrain, buildings and tree lines are ignored; air is assumed to travel in straight segments.",
  "Facility emission rates and on-site activities are unknown to this screen.",
  "Odors can linger after the wind shifts, and reported times may be approximate.",
  "This is a screening aid for investigators. It does not determine responsibility.",
];

export function backTrajectory(origin: LatLon, at: Date, hours: WeatherHour[]): TrajectoryPoint[] {
  const pts: TrajectoryPoint[] = [{ lat: origin.lat, lon: origin.lon, minutesBefore: 0 }];
  let pos = origin;
  const steps = (SCREENING.TRAJ_HOURS * 60) / SCREENING.TRAJ_STEP_MIN;
  for (let i = 1; i <= steps; i++) {
    const t = new Date(at.getTime() - (i - 0.5) * SCREENING.TRAJ_STEP_MIN * 60_000);
    const w = windAt(hours, t);
    if (!w) break;
    // The parcel arrived FROM the wind's "from" direction, so step that way.
    const dist = w.speedMph * MPH_TO_MS * SCREENING.TRAJ_STEP_MIN * 60;
    pos = destination(pos, w.fromDeg, dist);
    pts.push({ lat: pos.lat, lon: pos.lon, minutesBefore: i * SCREENING.TRAJ_STEP_MIN });
    if (distanceM(origin, pos) > SCREENING.MAX_DISTANCE_M * 1.5) break;
  }
  return pts;
}

/** Distance from point p to the polyline, metres (flat approximation, fine at this scale). */
function distanceToPath(p: LatLon, path: LatLon[]): number {
  if (path.length === 0) return Infinity;
  if (path.length === 1) return distanceM(p, path[0]);
  const kx = 111_320 * Math.cos((p.lat * Math.PI) / 180);
  const ky = 111_320;
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const ax = (path[i].lon - p.lon) * kx, ay = (path[i].lat - p.lat) * ky;
    const bx = (path[i + 1].lon - p.lon) * kx, by = (path[i + 1].lat - p.lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

/** Groups of candidate ids that lie in nearly the same direction from the observer. */
function groupIndistinguishable(cands: Candidate[]): number[][] {
  const groups: number[][] = [];
  const used = new Set<number>();
  for (const a of cands) {
    if (used.has(a.facilityId)) continue;
    const g = cands.filter(
      (b) => !used.has(b.facilityId) && angleDiff(a.bearingFromObserver, b.bearingFromObserver) <= SCREENING.INDISTINGUISHABLE_DEG,
    );
    if (g.length > 1) {
      g.forEach((b) => used.add(b.facilityId));
      groups.push(g.map((b) => b.facilityId));
    }
  }
  return groups;
}

export function screenSources(
  observer: LatLon,
  observedAt: Date,
  hours: WeatherHour[] | null,
  facilities: Facility[],
): ScreeningResult {
  const assumptions = [...BASE_ASSUMPTIONS];
  const missing: string[] = [];
  const inconclusiveReasons: string[] = [];
  const nearby = (): Candidate[] =>
    facilities
      .map((f) => ({ f, d: distanceM(observer, f) }))
      .filter((x) => x.d <= SCREENING.CALM_NEARBY_M)
      .sort((a, b) => a.d - b.d)
      .map(({ f, d }) => ({
        facilityId: f.id,
        name: f.name,
        distanceM: d,
        bearingFromObserver: bearingDeg(observer, f),
        angleOffWind: NaN,
        inCone: false,
        trajectoryHit: false,
        trajectoryMissM: null,
        level: "nearby" as const,
        reasons: [`Within ${(d / 1000).toFixed(1)} km of the observation; wind direction could not narrow it down.`],
      }));

  const wind = hours ? windAt(hours, observedAt) : null;
  if (!hours || !wind) {
    missing.push("Weather for the observation time (retrieval failed or not yet attached).");
    inconclusiveReasons.push("No wind estimate is available for this time, so direction cannot be used.");
    return {
      verdict: "inconclusive",
      headline: "Inconclusive: wind data missing",
      wind: null,
      toleranceDeg: null,
      candidates: nearby(),
      indistinguishable: [],
      trajectory: [],
      assumptions,
      missing,
      inconclusiveReasons,
    };
  }

  const windInfo = { speedMph: wind.speedMph, fromDeg: wind.fromDeg, compass: compass(wind.fromDeg) };
  const prior = hoursAround(hours, observedAt, 2, 0).filter((h) => h.windFromDeg != null && (h.windSpeedMph ?? 0) >= SCREENING.CALM_MPH);
  const spread = prior.length >= 2 ? maxBearingSpread(prior.map((h) => h.windFromDeg!)) : 0;

  if (wind.speedMph < SCREENING.CALM_MPH) {
    inconclusiveReasons.push(
      `Wind was about ${wind.speedMph.toFixed(1)} mph, which counts as calm (under ${SCREENING.CALM_MPH} mph). In calm air, direction is not meaningful and odors can pool in any direction.`,
    );
  }
  if (spread >= SCREENING.VARIABLE_SPREAD) {
    inconclusiveReasons.push(`Wind direction swung about ${Math.round(spread)}° in the 2 hours before the observation (variable wind).`);
  }
  if (inconclusiveReasons.length) {
    return {
      verdict: "inconclusive",
      headline: wind.speedMph < SCREENING.CALM_MPH ? "Inconclusive: calm wind" : "Inconclusive: variable wind",
      wind: windInfo,
      toleranceDeg: null,
      candidates: nearby(),
      indistinguishable: [],
      trajectory: [],
      assumptions,
      missing,
      inconclusiveReasons,
    };
  }

  const tolerance = wind.speedMph < SCREENING.LIGHT_MPH || spread > 30 ? SCREENING.WIDE_TOL : SCREENING.BASE_TOL;
  if (tolerance === SCREENING.WIDE_TOL)
    assumptions.push(`Tolerance widened to ±${SCREENING.WIDE_TOL}° because the wind was light or shifting.`);

  const trajectory = backTrajectory(observer, observedAt, hours);
  if (trajectory.length < 4) missing.push("Hourly wind before the observation (back-trajectory is short).");

  const candidates: Candidate[] = [];
  for (const f of facilities) {
    const d = distanceM(observer, f);
    const b = bearingDeg(observer, f);
    const off = angleDiff(b, wind.fromDeg);
    const inCone = off <= tolerance && d <= SCREENING.MAX_DISTANCE_M;
    const miss = distanceToPath(f, trajectory);
    const trajectoryHit = miss <= SCREENING.TRAJ_HIT_M && d <= SCREENING.MAX_DISTANCE_M;
    if (!inCone && !trajectoryHit) continue;
    const reasons: string[] = [];
    if (inCone)
      reasons.push(
        `Lies ${compass(b)} of the observer (${Math.round(b)}°), ${Math.round(off)}° off the wind direction (from ${compass(wind.fromDeg)}, ${Math.round(wind.fromDeg)}°); within ±${tolerance}°.`,
      );
    else reasons.push(`Outside the ±${tolerance}° upwind cone (${Math.round(off)}° off), but near the back-trajectory.`);
    if (trajectoryHit) reasons.push(`Back-trajectory passes within ${Math.round(miss)} m.`);
    else reasons.push(`Back-trajectory passes ${(miss / 1000).toFixed(1)} km away.`);
    reasons.push(`Distance ${(d / 1000).toFixed(1)} km.`);
    candidates.push({
      facilityId: f.id,
      name: f.name,
      distanceM: d,
      bearingFromObserver: b,
      angleOffWind: off,
      inCone,
      trajectoryHit,
      trajectoryMissM: Number.isFinite(miss) ? miss : null,
      level: inCone && trajectoryHit && off <= tolerance / 2 + 5 ? "stronger" : "possible",
      reasons,
    });
  }
  candidates.sort((a, b) => (a.level === b.level ? a.angleOffWind - b.angleOffWind : a.level === "stronger" ? -1 : 1));

  if (!candidates.length) {
    return {
      verdict: "none_fit",
      headline: `No configured facility is upwind (wind from ${compass(wind.fromDeg)})`,
      wind: windInfo,
      toleranceDeg: tolerance,
      candidates: [],
      indistinguishable: [],
      trajectory,
      assumptions,
      missing: [
        ...missing,
        "The source may be one that is not configured (e.g. field application of manure or biosolids, septic systems, burning) or local winds may differ from the model.",
      ],
      inconclusiveReasons,
    };
  }

  const indistinguishable = groupIndistinguishable(candidates);
  const headline =
    candidates.length === 1
      ? `1 facility fits the wind: ${candidates[0].name}`
      : `${candidates.length} facilities fit the wind${indistinguishable.length ? "; some cannot be told apart from this location" : ""}`;
  return {
    verdict: "candidates",
    headline,
    wind: windInfo,
    toleranceDeg: tolerance,
    candidates,
    indistinguishable,
    trajectory,
    assumptions,
    missing,
    inconclusiveReasons,
  };
}

/**
 * Corroboration across several reports: count how many reports' screens list each facility.
 */
export function corroborate(results: ScreeningResult[]) {
  const votes = new Map<number, { name: string; votes: number; stronger: number }>();
  let usable = 0;
  for (const r of results) {
    if (r.verdict === "inconclusive") continue;
    usable++;
    for (const c of r.candidates) {
      const v = votes.get(c.facilityId) ?? { name: c.name, votes: 0, stronger: 0 };
      v.votes++;
      if (c.level === "stronger") v.stronger++;
      votes.set(c.facilityId, v);
    }
  }
  return {
    usable,
    total: results.length,
    facilities: [...votes.entries()].map(([id, v]) => ({ facilityId: id, ...v })).sort((a, b) => b.votes - a.votes),
  };
}
