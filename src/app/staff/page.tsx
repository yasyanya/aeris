import { allFacilities, clusterAlerts, staffReportList } from "@/lib/data";
import { currentUser } from "@/lib/auth";
import StaffInbox from "./StaffInbox";

export const metadata = { title: "Reports" };

export default async function StaffHome() {
  const user = (await currentUser())!;
  const rows = staffReportList({ days: 30 });
  const alert = clusterAlerts(24)[0] ?? null;
  return <StaffInbox rows={rows} facilities={allFacilities()} alert={alert} userName={user.name.split(" ")[0]} />;
}
