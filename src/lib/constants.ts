// Shared domain constants. Safe to import from client and server code.

export const TIMEZONE = "America/Chicago";

export const MAP_CENTER: [number, number] = [33.272, -96.552];
export const MAP_ZOOM = 12;
/** South-west / north-east corners of the area the app covers. */
export const MAP_BOUNDS: [[number, number], [number, number]] = [
  [33.2, -96.63],
  [33.34, -96.47],
];

export const INTENSITY = [
  { value: 0, label: "No odor", short: "None", tceq: "No odor", color: "var(--i0)" },
  { value: 1, label: "Very light: barely noticeable", short: "Very light", tceq: "VL", color: "var(--i1)" },
  { value: 2, label: "Light: noticeable", short: "Light", tceq: "L", color: "var(--i2)" },
  { value: 3, label: "Moderate: clearly noticeable", short: "Moderate", tceq: "M", color: "var(--i3)" },
  { value: 4, label: "Strong: hard to ignore", short: "Strong", tceq: "S", color: "var(--i4)" },
  { value: 5, label: "Very strong: as bad as it gets", short: "Very strong", tceq: "VS", color: "var(--i5)" },
] as const;

export const CHARACTERS = [
  { key: "garbage", label: "Garbage / trash" },
  { key: "sulfur", label: "Rotten egg / sulfur" },
  { key: "sewage", label: "Sewage" },
  { key: "ammonia", label: "Ammonia / sharp" },
  { key: "manure", label: "Manure / livestock" },
  { key: "compost", label: "Compost / earthy / mulch" },
  { key: "chemical", label: "Chemical / fuel" },
  { key: "smoke", label: "Smoke / burning" },
  { key: "other", label: "Other" },
] as const;
export type CharacterKey = (typeof CHARACTERS)[number]["key"];
export const CHARACTER_KEYS = CHARACTERS.map((c) => c.key) as [CharacterKey, ...CharacterKey[]];

/** Duration buckets aligned with the TCEQ odor investigation protocol. */
export const DURATIONS = [
  { key: "lt1m", label: "Under a minute" },
  { key: "10m", label: "About 10 minutes" },
  { key: "1h", label: "About an hour" },
  { key: "4h", label: "Several hours" },
  { key: "12h", label: "Most of the day (12 h+)" },
  { key: "unknown", label: "Not sure / just noticed it" },
] as const;
export type DurationKey = (typeof DURATIONS)[number]["key"];
export const DURATION_KEYS = DURATIONS.map((d) => d.key) as [DurationKey, ...DurationKey[]];

export const SYMPTOMS = [
  { key: "headache", label: "Headache" },
  { key: "nausea", label: "Nausea" },
  { key: "eyes_throat", label: "Eye or throat irritation" },
  { key: "breathing", label: "Trouble breathing" },
  { key: "sleep", label: "Disturbed sleep" },
  { key: "stayed_inside", label: "Had to stay or go inside" },
] as const;
export type SymptomKey = (typeof SYMPTOMS)[number]["key"];
export const SYMPTOM_KEYS = SYMPTOMS.map((s) => s.key) as [SymptomKey, ...SymptomKey[]];

export const STATUSES = [
  { key: "received", label: "Received" },
  { key: "under_review", label: "Under review" },
  { key: "investigating", label: "Investigation underway" },
  { key: "responded", label: "Response published" },
  { key: "closed", label: "Closed" },
] as const;
export type StatusKey = (typeof STATUSES)[number]["key"];

/** Privacy: a public map cell is shown only if it holds at least this many reports. */
export const K_ANONYMITY = 3;
/** A category is listed for a cell only if at least this many reports share it. */
export const CATEGORY_MIN = 2;
/** Hex cell "radius" in metres (centre to corner). About 520 m across. */
export const HEX_SIZE_M = 300;

export const RESOURCES = [
  {
    title: "Odor management at solid waste facilities",
    org: "NTMWD",
    blurb: "How NTMWD controls odors at the 121 Regional Disposal Facility: daily cover, gas collection, misting and patrols.",
    href: "https://ntmwd.com/293/Odor-Management---Solid-Waste-Facilities",
  },
  {
    title: "Odor FAQ",
    org: "NTMWD",
    blurb: "What's that smell, why it changes with the weather, and whether it is a health concern.",
    href: "https://www.ntmwd.com/Faq.aspx?TID=23",
  },
  {
    title: "How landfills work",
    org: "NTMWD",
    blurb: "Liners, cells, daily cover and landfill gas, explained step by step.",
    href: "https://www.ntmwd.com/292/How-Landfills-Work",
  },
  {
    title: "Regional solid waste system",
    org: "NTMWD",
    blurb: "The transfer stations and the disposal facility that serve the region.",
    href: "https://ntmwd.com/291/Solid-Waste-System",
  },
  {
    title: "Sister Grove Regional Water Resource Recovery Facility",
    org: "NTMWD",
    blurb: "The new wastewater treatment facility southwest of Melissa.",
    href: "https://ntmwd.com/240/Sister-Grove-RWRRF",
  },
  {
    title: "File an environmental complaint",
    org: "TCEQ",
    blurb: "The state regulator's official complaint process. Use it alongside Aeris for formal nuisance cases.",
    href: "https://www.tceq.texas.gov/compliance/complaints",
  },
] as const;

export const TCEQ_COMPLAINT_URL = "https://www.tceq.texas.gov/compliance/complaints";

export function intensityInfo(v: number) {
  return INTENSITY[Math.max(0, Math.min(5, Math.round(v)))];
}
export function characterLabel(k: string) {
  return CHARACTERS.find((c) => c.key === k)?.label ?? k;
}
export function durationLabel(k: string) {
  return DURATIONS.find((d) => d.key === k)?.label ?? k;
}
export function statusLabel(k: string) {
  return STATUSES.find((s) => s.key === k)?.label ?? k;
}
export function symptomLabel(k: string) {
  return SYMPTOMS.find((s) => s.key === k)?.label ?? k;
}
