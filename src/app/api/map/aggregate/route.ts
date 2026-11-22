import { NextResponse } from "next/server";
import { publicAggregate } from "@/lib/data";

// PUBLIC endpoint: returns only k-anonymous hex cells, never raw coordinates or free text.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const to = sp.get("to") ? new Date(sp.get("to")!) : new Date();
  const from = sp.get("from") ? new Date(sp.get("from")!) : new Date(to.getTime() - 7 * 86_400_000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to)
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  if (to.getTime() - from.getTime() > 92 * 86_400_000) return NextResponse.json({ error: "Range too long (max 92 days)" }, { status: 400 });
  return NextResponse.json(publicAggregate(from, to), { headers: { "Cache-Control": "no-store" } });
}
