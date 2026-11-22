// Schema + connection. No server-only import so the seed script (tsx) can use it.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('resident','staff','manager')),
  password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS facilities (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  operator TEXT,
  type TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 1,
  approx INTEGER NOT NULL DEFAULT 1,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY,
  receipt_code TEXT NOT NULL UNIQUE,
  user_id INTEGER REFERENCES users(id),
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  location_method TEXT NOT NULL DEFAULT 'pin',
  cell_id TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  intensity INTEGER NOT NULL,
  characters TEXT NOT NULL DEFAULT '[]',
  character_other TEXT,
  duration TEXT NOT NULL,
  ongoing INTEGER NOT NULL DEFAULT 0,
  symptoms TEXT NOT NULL DEFAULT '[]',
  suspected_source TEXT,
  notes TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  consent_contact INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'received',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_observed ON reports(observed_at);
CREATE TABLE IF NOT EXISTS weather_snapshots (
  report_id INTEGER PRIMARY KEY REFERENCES reports(id) ON DELETE CASCADE,
  fetch_status TEXT NOT NULL CHECK (fetch_status IN ('ok','failed','pending')),
  source TEXT,
  sample_time TEXT,
  wind_speed_mph REAL,
  wind_from_deg REAL,
  gust_mph REAL,
  temp_f REAL,
  rh REAL,
  pressure_hpa REAL,
  cloud_cover REAL,
  precip_in REAL,
  blh_m REAL,
  hours_json TEXT,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT
);
CREATE TABLE IF NOT EXISTS screening_results (
  report_id INTEGER PRIMARY KEY REFERENCES reports(id) ON DELETE CASCADE,
  computed_at TEXT NOT NULL,
  verdict TEXT NOT NULL,
  result_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS investigation_entries (
  id INTEGER PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('patrol','operational','note')),
  observed_at TEXT NOT NULL,
  location_text TEXT,
  odor_detected INTEGER,
  intensity INTEGER,
  character TEXT,
  wind_text TEXT,
  notes TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','published')),
  author_id INTEGER REFERENCES users(id),
  reviewed_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  published_at TEXT
);
CREATE TABLE IF NOT EXISTS timeline_events (
  id INTEGER PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 1,
  message TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_timeline_report ON timeline_events(report_id);
`;

export function dbPath() {
  return process.env.AERIS_DB ?? path.join(process.cwd(), "data", "aeris.db");
}

export function openDatabase(file = dbPath()) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  return db;
}

