import { NextResponse } from "next/server";
import { currentUser, isStaff } from "@/lib/auth";
import { MAP_BOUNDS } from "@/lib/constants";
import { fetchGridAt } from "@/lib/weather";

// Coarse 5×5 grid of modelled wind for the staff map (one Open-Meteo request).
export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || !isStaff(u.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const t = new URL(req.url).searchParams.get("t");
  const at = t ? new Date(t) : new Date();
  if (Number.isNaN(at.getTime())) return NextResponse.json({ error: "Bad time" }, { status: 400 });
  const [[s, w], [n, e]] = MAP_BOUNDS;
  const pts: { lat: number; lon: number }[] = [];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) pts.push({ lat: s + ((n - s) * (i + 0.5)) / 5, lon: w + ((e - w) * (j + 0.5)) / 5 });
  return NextResponse.json(await fetchGridAt(pts, at));
}
