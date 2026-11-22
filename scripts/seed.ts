// Reset the local database and seed it with demo data.
// Tries to use REAL Open-Meteo weather for the last 31 days; falls back to synthetic weather offline.
//   npm run seed            → real weather if reachable
//   npm run seed -- --offline
import fs from "node:fs";
import { dbPath, openDatabase } from "../src/lib/db-core";
import { seedDatabase, DEMO_USERS, DEMO_PASSWORD } from "../src/lib/seed";
import { fetchHourly } from "../src/lib/weather";
import { MAP_CENTER } from "../src/lib/constants";
import type { WeatherHour } from "../src/lib/wind";

async function main() {
  const file = dbPath();
  for (const f of [file, `${file}-wal`, `${file}-shm`]) if (fs.existsSync(f)) fs.rmSync(f);
  const db = openDatabase(file);

  let weather: "synthetic" | WeatherHour[] = "synthetic";
  if (!process.argv.includes("--offline")) {
    const now = new Date();
    const res = await fetchHourly(MAP_CENTER[0], MAP_CENTER[1], new Date(now.getTime() - 32 * 86_400_000), now, { timeoutMs: 15000 });
    if (res.ok && res.hours.some((h) => h.windSpeedMph != null)) {
      weather = res.hours.filter((h) => h.windSpeedMph != null);
      console.log(`✓ Using real Open-Meteo weather (${weather.length} hours)`);
    } else {
      console.log(`! Open-Meteo unavailable (${res.ok ? "no data" : res.error}); using synthetic demo weather`);
    }
  }
  seedDatabase(db, { weather });
  const n = (db.prepare("SELECT COUNT(*) n FROM reports").get() as { n: number }).n;
  console.log(`✓ Seeded ${n} reports into ${file}`);
  console.log("Demo accounts (password: %s):", DEMO_PASSWORD);
  for (const u of DEMO_USERS) console.log(`  ${u.role.padEnd(9)} ${u.email}`);
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
