import { randomInt } from "node:crypto";

// Crockford-style alphabet without look-alike characters (no I, L, O, U, 0, 1).
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

/** e.g. MEL-7K3Q-92XH: 8 random symbols ≈ 39 bits, rate-limited on lookup. */
export function newReceiptCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `MEL-${s.slice(0, 4)}-${s.slice(4)}`;
}

export function normalizeReceipt(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^MEL/, "");
  if (raw.length !== 8) return "";
  return `MEL-${raw.slice(0, 4)}-${raw.slice(4)}`;
}
