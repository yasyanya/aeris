import { requireStaff } from "@/lib/auth";
import { StaffRail } from "./StaffRail";

export const metadata = { title: { default: "Staff", template: "%s · Staff · Aeris" } };
export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  return (
    <div className="flex min-h-screen bg-canvas p-0 md:gap-3 md:p-3">
      <StaffRail user={user} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
