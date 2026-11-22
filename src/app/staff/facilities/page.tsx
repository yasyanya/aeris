import { currentUser } from "@/lib/auth";
import { allFacilities } from "@/lib/data";
import { FacilityForm } from "./FacilityForm";

export const metadata = { title: "Facilities" };

export default async function FacilitiesPage() {
  const user = (await currentUser())!;
  const facilities = allFacilities();
  const canEdit = user.role === "manager";
  return (
    <main className="mx-auto max-w-[1200px] px-6 py-7">
      <p className="s-label">Configuration</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Facilities used for screening</h1>
      <p className="mt-2 max-w-2xl text-sm text-s-ink-2">
        Screening only considers facilities listed here. Seeded coordinates are approximate, so verify them against site plans before
        relying on results. Hidden facilities are still screened but don&apos;t appear on the public map.
        {!canEdit && " Only managers can edit."}
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {facilities.map((f) => (
          <FacilityForm key={f.id} facility={f} canEdit={canEdit} />
        ))}
        {canEdit && <FacilityForm facility={null} canEdit />}
      </div>
    </main>
  );
}
