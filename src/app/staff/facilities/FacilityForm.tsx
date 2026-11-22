"use client";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { saveFacility } from "../actions";

type F = { id: number; name: string; operator: string | null; type: string; lat: number; lon: number; is_public: number; notes: string | null };

export function FacilityForm({ facility: f, canEdit }: { facility: F | null; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveFacility, null as null | { error?: string; ok?: boolean });
  return (
    <form action={action} className="s-card space-y-3 p-5">
      {f && <input type="hidden" name="id" value={f.id} />}
      <div className="flex items-center justify-between">
        <p className="s-label">{f ? `Facility #${f.id}` : "Add facility"}</p>
        {f && (
          <span className={`badge ${f.is_public ? "bg-s-cyan/15 text-s-cyan" : "bg-s-panel-2 text-s-ink-3"}`}>
            {f.is_public ? "Public" : "Staff only"}
          </span>
        )}
      </div>
      <fieldset disabled={!canEdit} className="space-y-3">
        <input name="name" defaultValue={f?.name} placeholder="Name" className="s-input" required />
        <div className="grid grid-cols-2 gap-2">
          <input name="operator" defaultValue={f?.operator ?? ""} placeholder="Operator" className="s-input" />
          <select name="type" defaultValue={f?.type ?? "other"} className="s-input">
            {["landfill", "compost", "agriculture", "wastewater", "industrial", "other"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input name="lat" defaultValue={f?.lat} placeholder="Latitude" className="s-input" inputMode="decimal" required />
          <input name="lon" defaultValue={f?.lon} placeholder="Longitude" className="s-input" inputMode="decimal" required />
        </div>
        <textarea name="notes" defaultValue={f?.notes ?? ""} placeholder="Notes" rows={2} className="s-input h-auto py-2" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_public" defaultChecked={f ? !!f.is_public : true} className="accent-[var(--s-cyan)]" />
          Show on public map
        </label>
      </fieldset>
      {canEdit && (
        <div className="flex items-center gap-3">
          <button className="s-btn s-btn-primary" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />} {f ? "Save" : "Add"}
          </button>
          {state?.error && <span className="text-[13px] text-s-accent">{state.error}</span>}
          {state?.ok && <span className="text-[13px] text-s-cyan">Saved · recent reports re-screened</span>}
        </div>
      )}
    </form>
  );
}
