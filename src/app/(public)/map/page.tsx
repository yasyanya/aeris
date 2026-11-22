import { publicAggregate } from "@/lib/data";
import { currentConditions, forwardPath } from "@/lib/conditions";
import PublicMapView from "./PublicMapView";

export const metadata = { title: "Community map" };
export const dynamic = "force-dynamic";

export default async function MapPage() {
  const now = new Date();
  const initial = publicAggregate(new Date(now.getTime() - 7 * 86_400_000), now);
  const cond = await currentConditions();
  // Forward "where the air may be heading" paths from public facilities, next 2 h (illustrative estimate).
  const paths =
    cond.ok && cond.now && (cond.now.windSpeedMph ?? 0) >= 2
      ? initial.facilities.map((f) => ({ facilityId: f.id, points: forwardPath(f, [cond.now!, ...cond.next], now) }))
      : [];
  return (
    <PublicMapView
      initial={initial}
      wind={cond.ok && cond.now ? { speedMph: cond.now.windSpeedMph, fromDeg: cond.now.windFromDeg, t: cond.now.t } : null}
      paths={paths}
    />
  );
}
