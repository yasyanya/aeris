import { TIMEZONE } from "./constants";

const dt = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const d = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, month: "short", day: "numeric" });
const t = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, hour: "numeric", minute: "2-digit" });
const wd = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "short", month: "short", day: "numeric" });

export const fmtDateTime = (iso: string | Date) => dt.format(new Date(iso));
export const fmtDate = (iso: string | Date) => d.format(new Date(iso));
export const fmtTime = (iso: string | Date) => t.format(new Date(iso));
export const fmtWeekday = (iso: string | Date) => wd.format(new Date(iso));

export function fmtAgo(iso: string | Date, now = Date.now()) {
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export const fmtKm = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
export const fmtMi = (m: number) => `${(m / 1609.34).toFixed(1)} mi`;

/** Convert an ISO instant into the value for <input type="datetime-local"> in Central time. */
export function toLocalInput(iso: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const g = (k: string) => parts.find((p) => p.type === k)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

/** Parse a datetime-local value as Central time and return the UTC instant. */
export function fromLocalInput(value: string): Date {
  const [datePart, timePart] = value.split("T");
  const [y, mo, da] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);
  // Start from a UTC guess, then correct by the zone offset at that instant (handles DST).
  const guess = Date.UTC(y, mo - 1, da, h, mi);
  const asLocal = new Date(toLocalInput(new Date(guess)) + ":00Z").getTime();
  return new Date(guess - (asLocal - guess));
}
