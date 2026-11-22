import "server-only";
import { headers } from "next/headers";

// Simple in-memory fixed-window limiter. Fine for a single-instance prototype.
const buckets = new Map<string, { count: number; resetAt: number }>();

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterS: 0 };
  }
  b.count++;
  return { ok: b.count <= limit, retryAfterS: Math.ceil((b.resetAt - now) / 1000) };
}
