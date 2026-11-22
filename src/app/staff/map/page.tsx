import { allFacilities, clusterAlerts, staffReportList } from "@/lib/data";
import StaffMapView from "./StaffMapView";

export const metadata = { title: "Analysis map" };

export default async function StaffMapPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams;
  const rows = staffReportList({ days: 30 });
  return (
    <StaffMapView
      rows={rows}
      facilities={allFacilities()}
      alerts={clusterAlerts(24 * 30).map((a) => ({ ...a.center, ids: a.ids, end: a.end }))}
      initialSelected={(ids ?? "").split(",").map(Number).filter(Boolean)}
    />
  );
}
