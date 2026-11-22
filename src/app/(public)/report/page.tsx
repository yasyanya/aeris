import { publicFacilities } from "@/lib/data";
import ReportWizard from "./ReportWizard";

export const metadata = { title: "Report an odor" };
export const dynamic = "force-dynamic";

export default function ReportPage() {
  return <ReportWizard facilities={publicFacilities()} />;
}
