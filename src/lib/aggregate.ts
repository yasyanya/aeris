// Privacy-preserving aggregation for the public map.
// Runs on the server only. Raw coordinates and free text never leave it.
import { CATEGORY_MIN, HEX_SIZE_M, K_ANONYMITY, TIMEZONE } from "./constants";
import { hexCellId, hexCenter, hexPolygon } from "./geo";

export type AggInput = { lat: number; lon: number; intensity: number; characters: string[]; observedAt: string };

export type PublicCell = {
  id: string;
  polygon: [number, number][];
  center: [number, number];
  count: number;
  medianIntensity: number;
  categories: { key: string; count: number }[];
};

export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function aggregateCells(rows: AggInput[], k = K_ANONYMITY, size = HEX_SIZE_M) {
  const groups = new Map<string, AggInput[]>();
  for (const r of rows) {
    const id = hexCellId(r, size);
    const g = groups.get(id);
    if (g) g.push(r);
    else groups.set(id, [r]);
  }
  const cells: PublicCell[] = [];
  let hidden = 0;
  for (const [id, g] of groups) {
    if (g.length < k) {
      hidden += g.length;
      continue;
    }
    const catCounts = new Map<string, number>();
    for (const r of g) for (const c of new Set(r.characters)) catCounts.set(c, (catCounts.get(c) ?? 0) + 1);
    const c = hexCenter(id, size);
    cells.push({
      id,
      polygon: hexPolygon(id, size),
      center: [c.lat, c.lon],
      count: g.length,
      medianIntensity: median(g.map((r) => r.intensity)),
      categories: [...catCounts.entries()]
        .filter(([key, n]) => n >= CATEGORY_MIN && key !== "other")
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count),
    });
  }
  cells.sort((a, b) => b.count - a.count);
  return { cells, hiddenCount: hidden, total: rows.length };
}

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
export const localDay = (iso: string | Date) => dayFmt.format(typeof iso === "string" ? new Date(iso) : iso);

/** Per-day totals for the timeline strip (local Central time). */
export function dailyStrip(rows: AggInput[], days: number, now = new Date()) {
  const out: { date: string; total: number; strong: number }[] = [];
  for (let i = days - 1; i >= 0; i--) out.push({ date: localDay(new Date(now.getTime() - i * 86_400_000)), total: 0, strong: 0 });
  const idx = new Map(out.map((d, i) => [d.date, i]));
  for (const r of rows) {
    const i = idx.get(localDay(r.observedAt));
    if (i == null) continue;
    out[i].total++;
    if (r.intensity >= 3) out[i].strong++;
  }
  return out;
}
