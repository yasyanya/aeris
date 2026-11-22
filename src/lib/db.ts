import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "./db-core";
import { seedDatabase } from "./seed";

const g = globalThis as unknown as { __aerisDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (!g.__aerisDb) {
    const db = openDatabase();
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
    if (n === 0) seedDatabase(db, { weather: "synthetic" });
    g.__aerisDb = db;
  }
  return g.__aerisDb;
}

export type Row = Record<string, unknown>;
