"use client";
import dynamic from "next/dynamic";
import { useActionState, useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { addNote, publishResponse, saveDraft } from "../../actions";
import { fmtDateTime } from "@/lib/format";
import type { Fac, StaffPoint, TrajPoint } from "@/components/map/StaffLeaflet";

const StaffLeaflet = dynamic(() => import("@/components/map/StaffLeaflet"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-2" />,
});

export function DetailMap({
  report,
  nearby,
  facilities,
  trajectory,
  highlight,
}: {
  report: StaffPoint;
  nearby: StaffPoint[];
  facilities: Fac[];
  trajectory: TrajPoint[];
  highlight: number[];
}) {
  return (
    <StaffLeaflet
      points={[...nearby, report]}
      facilities={facilities}
      selectedId={report.id}
      trajectory={trajectory}
      highlightFacilities={highlight}
    />
  );
}

export function NoteForm({ reportId }: { reportId: number }) {
  // React 19 resets the form automatically after a successful action.
  const [state, action, pending] = useActionState(addNote.bind(null, reportId), null as null | { error?: string; ok?: boolean });
  return (
    <form action={action} className="mt-4 space-y-2.5 border-t border-line pt-4">
      <textarea name="notes" rows={3} required placeholder="What did you check or find?" className="input h-auto py-2.5" />
      <div className="flex flex-wrap items-center gap-2">
        <select name="odorDetected" defaultValue="" className="input h-9 w-auto pr-8 text-[13px]" aria-label="Odor on site">
          <option value="">Odor on site: not checked</option>
          <option value="yes">Odor on site: confirmed</option>
          <option value="no">Odor on site: none found</option>
        </select>
        <button className="btn btn-primary btn-sm ml-auto" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />} Add note
        </button>
      </div>
      {state?.error && <p className="text-[13px] text-danger">{state.error}</p>}
    </form>
  );
}

type Resp = { id: number; body: string; status: string; author: string | null; reviewer: string | null; createdAt: string; publishedAt: string | null };

export function ResponsePanel({ reportId, role, responses }: { reportId: number; role: string; responses: Resp[] }) {
  const draft = responses.find((r) => r.status === "draft");
  const published = responses.filter((r) => r.status === "published");
  const [state, action, pending] = useActionState(saveDraft.bind(null, reportId), null as null | { error?: string; ok?: boolean });
  const [publishing, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="mt-3 space-y-3">
      {published.map((p) => (
        <div key={p.id} className="rounded-xl bg-primary-soft px-3.5 py-3 text-sm">
          <p className="text-[12px] text-primary">
            Published {p.publishedAt && fmtDateTime(p.publishedAt)} · approved by {p.reviewer ?? "manager"}
          </p>
          <p className="mt-1">{p.body}</p>
        </div>
      ))}
      <form action={action} className="space-y-2.5">
        <textarea
          name="body"
          rows={5}
          defaultValue={draft?.body ?? ""}
          placeholder="In plain words: what was checked, what was found, and what was done."
          className="input h-auto py-2.5 leading-relaxed"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-ghost btn-sm" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />} Save draft
          </button>
          {role === "manager" && draft && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={publishing}
              onClick={() =>
                start(async () => {
                  try {
                    setErr(null);
                    await publishResponse(reportId);
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : "Couldn't publish");
                  }
                })
              }
            >
              {publishing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Approve &amp; publish
            </button>
          )}
          <span className="text-[12px] text-ink-3">
            {state?.ok
              ? "Draft saved"
              : draft
                ? `Draft by ${draft.author ?? "staff"}${role === "manager" ? "" : " · a manager will publish it"}`
                : role === "manager"
                  ? "Save a draft, then publish"
                  : "A manager reviews before it's published"}
          </span>
        </div>
        {(state?.error || err) && <p className="text-[13px] text-danger">{state?.error ?? err}</p>}
      </form>
    </div>
  );
}
