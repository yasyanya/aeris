// Small, dependency-free geodesy helpers. Accurate enough for distances of a
// few kilometres, which is all this app needs.

export type LatLon = { lat: number; lon: number };

const R = 6_371_000; // mean Earth radius, metres
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export const MPH_TO_MS = 0.44704;

/** Great-circle distance in metres. */
export function distanceM(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b, degrees clockwise from north, in [0, 360). */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lon - a.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Smallest absolute difference between two bearings, in [0, 180]. */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 540) % 360 - 180);
  return d;
}

/** Point reached by travelling `distM` metres from `p` on `bearing`. */
export function destination(p: LatLon, bearing: number, distM: number): LatLon {
  const δ = distM / R;
  const θ = toRad(bearing);
  const φ1 = toRad(p.lat);
  const λ1 = toRad(p.lon);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 =
    λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: toDeg(φ2), lon: ((toDeg(λ2) + 540) % 360) - 180 };
}

/** 16-point compass name for a bearing. */
export function compass(deg: number): string {
  const names = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return names[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

/** Convert wind (speed, direction it blows FROM) into u/v components (toward east / north). */
export function windToUV(speed: number, fromDeg: number): { u: number; v: number } {
  const toward = toRad((fromDeg + 180) % 360);
  return { u: speed * Math.sin(toward), v: speed * Math.cos(toward) };
}
export function uvToWind(u: number, v: number): { speed: number; fromDeg: number } {
  const speed = Math.hypot(u, v);
  const toward = (toDeg(Math.atan2(u, v)) + 360) % 360;
  return { speed, fromDeg: (toward + 180) % 360 };
}

/** Circular spread of a set of bearings: the largest pairwise difference. */
export function maxBearingSpread(bearings: number[]): number {
  let max = 0;
  for (let i = 0; i < bearings.length; i++)
    for (let j = i + 1; j < bearings.length; j++) max = Math.max(max, angleDiff(bearings[i], bearings[j]));
  return max;
}

// ---------- Hex grid used to aggregate public reports ----------
// A flat local projection anchored at a fixed origin keeps cell ids stable.
const ORIGIN: LatLon = { lat: 33.27, lon: -96.55 };
const M_PER_DEG_LAT = 111_320;
const mPerDegLon = (lat: number) => 111_320 * Math.cos(toRad(lat));

function toXY(p: LatLon) {
  return { x: (p.lon - ORIGIN.lon) * mPerDegLon(ORIGIN.lat), y: (p.lat - ORIGIN.lat) * M_PER_DEG_LAT };
}
function fromXY(x: number, y: number): LatLon {
  return { lat: ORIGIN.lat + y / M_PER_DEG_LAT, lon: ORIGIN.lon + x / mPerDegLon(ORIGIN.lat) };
}

/** Pointy-top axial hex coordinates for a point. */
export function hexCellId(p: LatLon, size: number): string {
  const { x, y } = toXY(p);
  const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / size;
  const r = ((2 / 3) * y) / size;
  // cube rounding
  let rx = Math.round(q);
  let rz = Math.round(r);
  const ry = Math.round(-q - r);
  const dx = Math.abs(rx - q);
  const dy = Math.abs(ry - (-q - r));
  const dz = Math.abs(rz - r);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (!(dy > dz)) rz = -rx - ry;
  return `${rx},${rz}`;
}

export function hexCenter(id: string, size: number): LatLon {
  const [q, r] = id.split(",").map(Number);
  const x = size * Math.sqrt(3) * (q + r / 2);
  const y = size * 1.5 * r;
  return fromXY(x, y);
}

export function hexPolygon(id: string, size: number): [number, number][] {
  const [q, r] = id.split(",").map(Number);
  const cx = size * Math.sqrt(3) * (q + r / 2);
  const cy = size * 1.5 * r;
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = toRad(60 * i - 30);
    const p = fromXY(cx + size * Math.cos(a), cy + size * Math.sin(a));
    pts.push([p.lat, p.lon]);
  }
  return pts;
}
