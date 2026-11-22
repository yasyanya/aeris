// Demo data: users, facilities and ~70 reports placed realistically downwind of
// facilities, so the map, screening and workflows have something to show.
import type { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import { angleDiff, bearingDeg, destination, distanceM } from "./geo";
import { addTimeline, insertReport, loadFacilities, runScreening, saveWeather } from "./reports-core";
import type { WeatherHour } from "./wind";
import { windAt } from "./wind";
import { TIMEZONE } from "./constants";

export const DEMO_PASSWORD = "demo1234";
export const DEMO_USERS = [
  { email: "resident@demo.aeris", name: "Demo Resident", role: "resident" },
  { email: "staff@demo.aeris", name: "Jordan Lee", role: "staff" },
  { email: "manager@demo.aeris", name: "Sam Rivera", role: "manager" },
] as const;

export const SEED_FACILITIES = [
  {
    name: "121 Regional Disposal Facility (landfill)",
    operator: "NTMWD",
    type: "landfill",
    lat: 33.2995,
    lon: -96.5274,
    is_public: 1,
    notes: "TCEQ MSW Permit 2294. Includes landfill gas collection. Coordinates approximate.",
  },
  {
    name: "Texas Pure Products compost",
    operator: "City of Plano",
    type: "compost",
    lat: 33.302,
    lon: -96.5209,
    is_public: 1,
    notes: "Compost operation within the disposal facility site. Coordinates approximate.",
  },
  {
    name: "Cattle feedlot (FM 545)",
    operator: "Private",
    type: "agriculture",
    lat: 33.2915,
    lon: -96.5047,
    is_public: 0,
    notes: "Private agricultural operation; hidden from the public map by default. Coordinates approximate.",
  },
  {
    name: "Sister Grove Regional WRRF",
    operator: "NTMWD",
    type: "wastewater",
    lat: 33.225,
    lon: -96.565,
    is_public: 1,
    notes: "Wastewater treatment, operational 2026. Location very approximate (±2 km). Verify before use.",
  },
];

// Residential areas around Melissa where demo reports are placed (approximate, illustrative).
const ANCHORS = [
  { lat: 33.3, lon: -96.555 },
  { lat: 33.2862, lon: -96.5722 },
  { lat: 33.2865, lon: -96.556 },
  { lat: 33.3195, lon: -96.535 },
  { lat: 33.3145, lon: -96.5615 },
  { lat: 33.2745, lon: -96.5355 },
  { lat: 33.2795, lon: -96.5155 },
  { lat: 33.318, lon: -96.506 },
  { lat: 33.2705, lon: -96.5605 },
];

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Plausible North-Texas-like hourly weather for the demo (used when Open-Meteo isn't reachable). */
export function syntheticWeather(from: Date, to: Date, seed = 7): WeatherHour[] {
  const rand = rng(seed);
  const out: WeatherHour[] = [];
  const start = Math.floor(from.getTime() / 3_600_000) * 3_600_000;
  let regimeLeft = 0;
  let dir = 180;
  let pressure = 1016;
  for (let ms = start; ms <= to.getTime(); ms += 3_600_000) {
    if (regimeLeft <= 0) {
      const r = rand();
      dir = r < 0.5 ? 175 + rand() * 30 : r < 0.75 ? 340 + rand() * 40 : r < 0.9 ? 120 + rand() * 30 : 280 + rand() * 30;
      regimeLeft = 30 + Math.floor(rand() * 60);
    }
    regimeLeft--;
    const localHour = (new Date(ms).getUTCHours() + 18) % 24; // ≈ Central time
    const day = localHour >= 10 && localHour <= 18;
    const night = localHour <= 6 || localHour >= 21;
    const speed = Math.max(0.3, (night ? 2.5 + rand() * 4 : day ? 8 + rand() * 9 : 4 + rand() * 6) + (rand() < 0.08 ? -3 : 0));
    pressure += (rand() - 0.5) * 0.8 + (dir > 300 || dir < 30 ? 0.15 : -0.08);
    pressure = Math.min(1030, Math.max(1002, pressure));
    out.push({
      t: new Date(ms).toISOString(),
      windSpeedMph: Math.round(speed * 10) / 10,
      windFromDeg: Math.round((dir + (rand() - 0.5) * 30 + 360) % 360),
      gustMph: Math.round((speed * 1.5 + rand() * 4) * 10) / 10,
      tempF: Math.round((night ? 44 : day ? 66 : 55) + (rand() - 0.5) * 8),
      rh: Math.round(night ? 75 + rand() * 20 : 40 + rand() * 25),
      pressureHpa: Math.round(pressure * 10) / 10,
      cloudCover: Math.round(rand() * 100),
      precipIn: rand() < 0.04 ? Math.round(rand() * 20) / 100 : 0,
      blhM: Math.round(night ? 80 + rand() * 200 : day ? 700 + rand() * 900 : 250 + rand() * 400),
    });
  }
  return out;
}

const localHourOf = (d: Date) =>
  Number(new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, hour: "numeric", hourCycle: "h23" }).format(d));

function pick<T>(rand: () => number, items: readonly T[], weights?: number[]) {
  if (!weights) return items[Math.floor(rand() * items.length)];
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rand() * total;
  for (let i = 0; i < items.length; i++) if ((x -= weights[i]) <= 0) return items[i];
  return items[items.length - 1];
}

const CHAR_BY_TYPE: Record<string, string[][]> = {
  landfill: [["garbage"], ["garbage", "sulfur"], ["garbage"], ["sulfur"]],
  compost: [["compost"], ["compost", "ammonia"], ["garbage", "compost"]],
  agriculture: [["manure"], ["manure", "ammonia"]],
  wastewater: [["sewage"], ["sewage", "sulfur"]],
  none: [["smoke"], ["chemical"], ["other"]],
};

const RESPONSES = [
  "Thank you for your report. Our solid waste team patrolled the neighborhood and the facility perimeter that morning. Light winds from the facility direction and a shallow inversion likely carried odors from the active working face. Crews applied additional daily cover and increased the perimeter misting system run time. We will keep monitoring under similar conditions.",
  "Thanks for letting us know. Staff checked the landfill gas collection system and found a well that needed adjustment; it was repaired the same day. Patrols afterwards found only faint odor at the fence line. Reports like yours help us find these issues quickly.",
  "We investigated this report. A patrol about an hour later found a moderate compost odor near the composting area while windrows were being turned. Turning has been rescheduled to times with steadier winds that carry odors away from homes.",
  "Thank you for reporting. Our review found that wind was blowing from a direction that does not line up with the disposal facility at that time, and patrols did not detect facility odors. The odor may have come from another source in the area. We have shared the details with the TCEQ regional office.",
];

export function seedDatabase(db: DatabaseSync, opts: { weather: "synthetic" | WeatherHour[]; now?: Date; seed?: number }) {
  const now = opts.now ?? new Date();
  const rand = rng(opts.seed ?? 42);
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  db.exec("BEGIN");
  try {
    for (const u of DEMO_USERS)
      db.prepare("INSERT INTO users (email,name,role,password_hash) VALUES (?,?,?,?)").run(u.email, u.name, u.role, hash);
    for (const f of SEED_FACILITIES)
      db.prepare("INSERT INTO facilities (name,operator,type,lat,lon,is_public,approx,notes) VALUES (?,?,?,?,?,?,1,?)").run(
        f.name,
        f.operator,
        f.type,
        f.lat,
        f.lon,
        f.is_public,
        f.notes,
      );
    const users = db.prepare("SELECT id,role FROM users").all() as { id: number; role: string }[];
    const residentId = users.find((u) => u.role === "resident")!.id;
    const staffId = users.find((u) => u.role === "staff")!.id;
    const managerId = users.find((u) => u.role === "manager")!.id;
    const facilities = loadFacilities(db);

    const from = new Date(now.getTime() - 31 * 86_400_000);
    const series = opts.weather === "synthetic" ? syntheticWeather(from, new Date(now.getTime() + 3 * 3_600_000)) : opts.weather;
    const source = opts.weather === "synthetic" ? "demo-synthetic" : "open-meteo:forecast";

    type Plan = { at: Date; cluster?: boolean };
    const plans: Plan[] = [];
    for (let i = 0; i < 90; i++) {
      const daysAgo = Math.floor(Math.pow(rand(), 1.3) * 30) + 0.2;
      const hour = pick(rand, [5, 6, 7, 8, 9, 12, 16, 19, 20, 21, 22, 23], [6, 9, 9, 7, 4, 1, 1, 3, 4, 5, 4, 2]);
      const base = new Date(now.getTime() - daysAgo * 86_400_000);
      const shift = ((hour - localHourOf(base) + 24) % 24) * 3_600_000;
      const at = new Date(base.getTime() + shift - (shift > 12 * 3_600_000 ? 86_400_000 : 0) + Math.floor(rand() * 50) * 60_000);
      if (at.getTime() < now.getTime() - 3 * 3_600_000) plans.push({ at });
    }
    // A fresh cluster ~1–2 h ago so the staff "event detected" alert has something to show.
    for (let i = 0; i < 4; i++) plans.push({ at: new Date(now.getTime() - (75 + i * 9) * 60_000), cluster: true });
    plans.sort((a, b) => a.at.getTime() - b.at.getTime());

    let residentAssigned = 0;
    let clusterAnchor: { lat: number; lon: number } | null = null;
    for (const [idx, p] of plans.entries()) {
      const w = windAt(series, p.at);
      const srcType = pick(rand, ["landfill", "compost", "agriculture", "none"], [68, 16, 11, 5]);
      const fac = facilities.find((f) => f.type === srcType) ?? facilities[0];
      let anchor = ANCHORS[Math.floor(rand() * ANCHORS.length)];
      if (p.cluster && clusterAnchor) anchor = clusterAnchor;
      else if (w && w.speedMph >= 2 && srcType !== "none") {
        const downwind = (w.fromDeg + 180) % 360;
        const scored = ANCHORS.map((a) => ({
          a,
          off: angleDiff(bearingDeg(fac, a), downwind),
          d: distanceM(fac, a),
        })).filter((x) => x.d > 900 && x.d < 6000);
        scored.sort((x, y) => x.off - y.off);
        if (scored.length && scored[0].off < 40) anchor = scored[Math.floor(rand() * Math.min(2, scored.length))].a;
      }
      if (p.cluster) clusterAnchor = anchor;
      const pos = destination(anchor, rand() * 360, rand() * 170);
      const calm = !w || w.speedMph < 3;
      const intensity = Math.min(5, Math.max(1, Math.round((calm ? 3.4 : 2.6) + (rand() - 0.4) * 2.6 + (p.cluster ? 1 : 0))));
      const ageDays = (now.getTime() - p.at.getTime()) / 86_400_000;
      const ownedByResident = !p.cluster && residentAssigned < 4 && [10, 30, 52, 60].includes(idx);
      if (ownedByResident) residentAssigned++;

      let status = "received";
      if (!p.cluster) {
        const r = rand();
        if (ageDays > 10) status = r < 0.7 ? "responded" : r < 0.9 ? "closed" : "under_review";
        else if (ageDays > 3) status = r < 0.45 ? "investigating" : r < 0.75 ? "under_review" : "responded";
        else status = r < 0.6 ? "received" : "under_review";
      }

      const { id } = insertReport(db, {
        userId: ownedByResident ? residentId : null,
        lat: pos.lat,
        lon: pos.lon,
        locationMethod: rand() < 0.6 ? "device" : "pin",
        observedAt: p.at.toISOString(),
        intensity,
        characters: pick(rand, CHAR_BY_TYPE[srcType]),
        duration: pick(rand, ["10m", "1h", "4h", "lt1m", "12h"], [4, 4, 2, 1, 1]),
        ongoing: ageDays < 0.2 && rand() < 0.5,
        symptoms: rand() < 0.35 ? [pick(rand, ["headache", "nausea", "stayed_inside", "sleep", "eyes_throat"])] : [],
        suspectedSource: rand() < 0.4 ? pick(rand, ["Landfill", "Compost site", "Feedlot", "Not sure"]) : null,
        notes: null,
        consentContact: rand() < 0.3,
        contactName: "Demo contact",
        contactEmail: "contact@example.com",
        createdAt: new Date(p.at.getTime() + Math.floor(rand() * 20) * 60_000).toISOString(),
        status,
      });

      // ~5% of reports show what happens when weather retrieval fails
      if (rand() < 0.05) saveWeather(db, id, p.at, { ok: false, source, error: "Request timed out (demo)" });
      else saveWeather(db, id, p.at, { ok: true, source, hours: series });
      const screen = runScreening(db, id);

      const t0 = p.at.getTime() + 40 * 60_000;
      const iso = (offsetMin: number) => new Date(t0 + offsetMin * 60_000).toISOString();
      if (status !== "received") addTimeline(db, id, "under_review", "A staff member is reviewing your report and its weather context.", true, iso(60));
      if (["investigating", "responded", "closed"].includes(status)) {
        addTimeline(db, id, "investigating", "Investigation underway: a patrol and facility checks were scheduled.", true, iso(120));
        db.prepare(
          `INSERT INTO investigation_entries (report_id,author_id,kind,observed_at,location_text,odor_detected,intensity,character,wind_text,notes,created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        ).run(
          id,
          staffId,
          "patrol",
          iso(90),
          "Neighborhood near report, then facility east fence line",
          screen.verdict === "candidates" ? 1 : 0,
          screen.verdict === "candidates" ? Math.max(1, intensity - 1) : 0,
          screen.verdict === "candidates" ? "garbage" : null,
          screen.wind ? `${screen.wind.compass} ${screen.wind.speedMph.toFixed(0)} mph (model)` : "n/a",
          screen.verdict === "candidates"
            ? "Faint to moderate odor at report location for ~15 min; stronger near the fence line."
            : "No facility odor detected during a 15-minute stop.",
          iso(100),
        );
        if (rand() < 0.6)
          db.prepare(
            `INSERT INTO investigation_entries (report_id,author_id,kind,observed_at,notes,created_at) VALUES (?,?,?,?,?,?)`,
          ).run(id, staffId, "operational", iso(130), "Checked working face cover, misting system and gas wellfield readings.", iso(135));
      }
      if (status === "responded" || status === "closed") {
        const body = screen.verdict === "none_fit" ? RESPONSES[3] : pick(rand, RESPONSES.slice(0, 3));
        db.prepare(
          "INSERT INTO responses (report_id,body,status,author_id,reviewed_by,created_at,published_at) VALUES (?,?,?,?,?,?,?)",
        ).run(id, body, "published", staffId, managerId, iso(600), iso(1400));
        addTimeline(db, id, "responded", "NTMWD published a response to your report.", true, iso(1400));
        if (status === "closed") addTimeline(db, id, "closed", "This report is closed.", true, iso(2000));
      }
      if (status === "investigating" && rand() < 0.5)
        db.prepare("INSERT INTO responses (report_id,body,status,author_id,created_at) VALUES (?,?,?,?,?)").run(
          id,
          RESPONSES[0],
          "draft",
          staffId,
          iso(400),
        );
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
