import { describe, expect, it } from "vitest";
import { destination, angleDiff, bearingDeg, hexCellId, compass } from "./geo";
import { screenSources, type Facility } from "./screening";
import { aggregateCells, median } from "./aggregate";
import type { WeatherHour } from "./wind";
import { windAt } from "./wind";

const observer = { lat: 33.28, lon: -96.55 };
const at = new Date("2026-03-10T15:20:00Z");

function hoursWith(speedMph: number, fromDeg: number | ((i: number) => number)): WeatherHour[] {
  const out: WeatherHour[] = [];
  for (let i = -5; i <= 2; i++) {
    const t = new Date(Date.UTC(2026, 2, 10, 15 + i, 0, 0));
    out.push({
      t: t.toISOString(),
      windSpeedMph: speedMph,
      windFromDeg: typeof fromDeg === "function" ? fromDeg(i) : fromDeg,
      gustMph: null, tempF: 60, rh: 50, pressureHpa: 1013, cloudCover: 20, precipIn: 0, blhM: 800,
    });
  }
  return out;
}

const place = (bearing: number, km: number, id: number, name: string): Facility => {
  const p = destination(observer, bearing, km * 1000);
  return { id, name, type: "landfill", lat: p.lat, lon: p.lon };
};

describe("geo", () => {
  it("handles bearing wraparound", () => {
    expect(angleDiff(350, 10)).toBeCloseTo(20);
    expect(angleDiff(10, 350)).toBeCloseTo(20);
    expect(compass(225)).toBe("SW");
  });
  it("destination/bearing round-trip", () => {
    const p = destination(observer, 225, 3000);
    expect(bearingDeg(observer, p)).toBeCloseTo(225, 0);
  });
  it("interpolates wind across north without flipping", () => {
    const hrs = hoursWith(10, (i) => (i % 2 === 0 ? 350 : 10));
    const w = windAt(hrs, new Date("2026-03-10T15:30:00Z"))!;
    expect(angleDiff(w.fromDeg, 0)).toBeLessThan(1);
  });
});

describe("screenSources", () => {
  const sw = place(225, 3, 1, "SW facility");
  const ne = place(45, 3, 2, "NE facility");

  it("SW wind makes the SW facility a candidate", () => {
    const r = screenSources(observer, at, hoursWith(10, 225), [sw, ne]);
    expect(r.verdict).toBe("candidates");
    expect(r.candidates.map((c) => c.facilityId)).toEqual([1]);
    expect(r.candidates[0].inCone).toBe(true);
    expect(r.candidates[0].trajectoryHit).toBe(true);
    expect(r.trajectory.length).toBeGreaterThan(5);
  });

  it("calm wind is inconclusive", () => {
    const r = screenSources(observer, at, hoursWith(1.2, 225), [sw, ne]);
    expect(r.verdict).toBe("inconclusive");
    expect(r.headline).toMatch(/calm/i);
  });

  it("missing weather is inconclusive but still saved/explained", () => {
    const r = screenSources(observer, at, null, [sw, ne]);
    expect(r.verdict).toBe("inconclusive");
    expect(r.missing.length).toBeGreaterThan(0);
  });

  it("variable wind is inconclusive", () => {
    const r = screenSources(observer, at, hoursWith(8, (i) => (i % 2 === 0 ? 90 : 200)), [sw]);
    expect(r.verdict).toBe("inconclusive");
  });

  it("no facility upwind gives none_fit", () => {
    const r = screenSources(observer, at, hoursWith(10, 135), [sw, ne]);
    expect(r.verdict).toBe("none_fit");
  });

  it("two facilities in the same direction are flagged indistinguishable", () => {
    const a = place(225, 2.5, 3, "A");
    const b = place(230, 3.2, 4, "B");
    const r = screenSources(observer, at, hoursWith(10, 227), [a, b]);
    expect(r.candidates).toHaveLength(2);
    expect(r.indistinguishable).toEqual([[3, 4]]);
  });

  it("facilities beyond the distance limit are excluded", () => {
    const far = place(225, 12, 5, "Far");
    const r = screenSources(observer, at, hoursWith(10, 225), [far]);
    expect(r.verdict).toBe("none_fit");
  });
});

describe("aggregateCells", () => {
  const base = { characters: ["garbage"], observedAt: at.toISOString() };
  it("hides cells below k and never exposes raw coordinates", () => {
    const rows = [
      { ...base, lat: 33.28, lon: -96.55, intensity: 2 },
      { ...base, lat: 33.2801, lon: -96.5501, intensity: 4 },
      { ...base, lat: 33.2799, lon: -96.5499, intensity: 3, characters: ["garbage", "sulfur"] },
      { ...base, lat: 33.31, lon: -96.6, intensity: 5 },
    ];
    const { cells, hiddenCount } = aggregateCells(rows);
    expect(cells).toHaveLength(1);
    expect(hiddenCount).toBe(1);
    expect(cells[0].count).toBe(3);
    expect(cells[0].medianIntensity).toBe(3);
    // 'sulfur' appears once (< CATEGORY_MIN), so it must not be listed
    expect(cells[0].categories.map((c) => c.key)).toEqual(["garbage"]);
    expect(JSON.stringify(cells)).not.toContain("33.2801");
    expect(hexCellId(rows[0], 300)).toBe(cells[0].id);
  });
  it("median", () => {
    expect(median([1, 5, 3, 4])).toBe(3.5);
  });
});
