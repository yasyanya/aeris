"use client";
import dynamic from "next/dynamic";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Loader2, RefreshCw, Satellite, Send, Map as MapIcon } from "lucide-react";
import { addEntry, publishResponse, rescreen, retryWeather, saveDraft, setStatus } from "../../actions";
import { CHARACTERS, INTENSITY } from "@/lib/constants";
import { fmtDateTime, toLocalInput } from "@/lib/format";
import type { Fac, Overlay, StaffPoint, WindPt } from "@/components/map/StaffLeaflet";

const StaffLeaflet = dynamic(() => import("@/components/map/StaffLeaflet"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-s-panel-2" />,
});

export function DetailMap({
  report,
  nearby,
  facilities,
  overlay,
  highlight,
  observedAt,
}: {
  report: StaffPoint;
  nearby: StaffPoint[];
  facilities: Fac[];
  overlay: Overlay;
  highlight: number[];
  observedAt: string;
}) {
  const [base, setBase] = useState<"satellite" | "dark">("satellite");
  const [wind, setWind] = useState<WindPt[]>([]);
  useEffect(() => {
    fetch(`/api/staff/windfield?t=${encodeURIComponent(observedAt)}`)
      .then((r) => r.json())
      .then((d) => setWind(d.points ?? []))
      .catch(() => setWind([]));
  }, [observedAt]);
  return (
    <div className="relative h-full">
      <StaffLeaflet
        base={base}
        points={[...nearby, report]}
        facilities={facilities}
        selectedIds={[report.id]}
        overlays={[overlay]}
        windField={wind}
        highlightFacilities={highlight}
        center={[report.lat, report.lon]}
        zoom={13}
      />
      <div className="absolute left-3 top-3 z-[500] flex gap-1 rounded-full bg-s-bg/85 p-1 backdrop-blur">
        {(["satellite", "dark"] as const).map((b) => (
          <button
            key={b}
            onClick={() => setBase(b)}
            className={`flex items-center gap-1.5 rounded-full px-3 h-8 text-[12px] ${base === b ? "bg-s-ink text-s-bg" : "text-s-ink-2"}`}
          >
            {b === "satellite" ? <Satellite className="size-3.5" /> : <MapIcon className="size-3.5" />}
            {b === "satellite" ? "Satellite" : "Dark"}
          </button>
        ))}
      </div>
      <div className="absolute bottom-3 left-3 z-[500] rounded-xl bg-s-bg/85 px-3 py-2 text-[11px] text-s-ink-2 backdrop-blur space-y-1">
        <p className="flex items-center gap-2">
          <span className="h-0.5 w-5 bg-white" /> Back-trajectory (dots every 20 min)
        </p>
        <p className="flex items-center gap-2">
          <span className="h-2.5 w-5 rounded bg-violet/50" /> Uncertainty band
        </p>
        <p className="flex items-center gap-2">
          <span className="h-2.5 w-5 rounded border border-dashed border-s-accent bg-s-accent/10" /> Upwind cone
        </p>
      </div>
    </div>
  );
}

export function StatusControls({ reportId, status }: { reportId: number; status: string }) {
  const [pending, start] = useTransition();
  const opts = [
    ["received", "Received"],
    ["under_review", "Under review"],
    ["investigating", "Investigating"],
    ["closed", "Closed"],
  ];
  return (
    <label className="flex items-center gap-2 text-[12px] text-s-ink-3">
      Status
      <select
        className="s-input h-9 w-44"
        value={status === "responded" ? "" : status}
        disabled={pending}
        onChange={(e) => start(() => setStatus(reportId, e.target.value))}
      >
        {status === "responded" && <option value="">Response published</option>}
        {opts.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      {pending && <Loader2 className="size-4 animate-spin" />}
    </label>
  );
}

export function WeatherActions({ reportId, weatherOk }: { reportId: number; weatherOk: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button className="s-btn" disabled={pending} onClick={() => start(() => (weatherOk ? rescreen(reportId) : retryWeather(reportId)))}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
      {weatherOk ? "Re-run screening" : "Retry weather"}
    </button>
  );
}

export function EntryForm({ reportId, defaultWind }: { reportId: number; defaultWind: string }) {
  const [state, action, pending] = useActionState(addEntry.bind(null, reportId), null as null | { error?: string; ok?: boolean });
  const [kind, setKind] = useState<"patrol" | "operational" | "note">("patrol");
  // React 19 resets uncontrolled form fields automatically after a successful action.
  return (
    <form action={action} className="mt-4 space-y-2.5 border-t border-s-line pt-4">
      <div className="flex gap-1 rounded-full bg-s-panel-2 p-1 text-[12px]">
        {(["patrol", "operational", "note"] as const).map((k) => (
          <label key={k} className={`flex-1 cursor-pointer rounded-full py-1.5 text-center ${kind === k ? "bg-s-ink text-s-bg" : "text-s-ink-2"}`}>
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
            {k === "patrol" ? "Patrol observation" : k === "operational" ? "Operational check" : "Note"}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="datetime-local" name="observedAt" defaultValue={toLocalInput(new Date())} className="s-input" aria-label="Observed at" />
        <input name="locationText" placeholder={kind === "patrol" ? "Where (e.g. east fence line)" : "Area / system checked"} className="s-input" />
      </div>
      {kind === "patrol" && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select name="odorDetected" className="s-input" defaultValue="" aria-label="Odor detected">
            <option value="">Odor detected?</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
          <select name="intensity" className="s-input" defaultValue="" aria-label="Intensity">
            <option value="">Intensity</option>
            {INTENSITY.map((i) => (
              <option key={i.value} value={i.value}>
                {i.value} · {i.tceq}
              </option>
            ))}
          </select>
          <select name="character" className="s-input" defaultValue="" aria-label="Character">
            <option value="">Character</option>
            {CHARACTERS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <input name="windText" defaultValue={defaultWind} placeholder="Wind observed" className="s-input" />
        </div>
      )}
      <textarea
        name="notes"
        rows={3}
        required
        placeholder={kind === "patrol" ? "What you observed, for how long (TCEQ log: stay ≥15 min)" : "What was checked and any action taken"}
        className="s-input h-auto py-2"
      />
      <div className="flex items-center gap-3">
        <button className="s-btn s-btn-primary" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />} Add to log
        </button>
        {state?.error && <span className="text-[13px] text-s-accent">{state.error}</span>}
        {state?.ok && <span className="text-[13px] text-s-cyan">Saved</span>}
      </div>
    </form>
  );
}

export function ResponsePanel({
  reportId,
  role,
  responses,
  clusterIds,
  clusterCodes,
}: {
  reportId: number;
  role: string;
  responses: { id: number; body: string; status: string; author: string | null; reviewer: string | null; createdAt: string; publishedAt: string | null }[];
  clusterIds: number[];
  clusterCodes: string[];
}) {
  const draft = responses.find((r) => r.status === "draft");
  const published = responses.filter((r) => r.status === "published");
  const [state, action, pending] = useActionState(saveDraft.bind(null, reportId), null as null | { error?: string; ok?: boolean });
  const [publishing, start] = useTransition();
  const [applyCluster, setApplyCluster] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="mt-3 space-y-4">
      {published.map((p) => (
        <div key={p.id} className="rounded-xl border border-s-cyan/30 bg-s-cyan/5 p-3.5 text-sm">
          <p className="text-[12px] text-s-cyan">
            Published {p.publishedAt && fmtDateTime(p.publishedAt)} · written by {p.author ?? "staff"} · approved by {p.reviewer ?? "manager"}
          </p>
          <p className="mt-1.5 text-s-ink-2">{p.body}</p>
        </div>
      ))}
      <form action={action} className="space-y-2.5">
        <textarea
          name="body"
          rows={6}
          defaultValue={draft?.body ?? ""}
          placeholder="Plain-language response for the resident: what was checked, what was found, and what was done. Avoid personal data."
          className="s-input h-auto py-2.5 leading-relaxed"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button className="s-btn" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />} Save draft for review
          </button>
          {draft && (
            <span className="text-[12px] text-s-ink-3">
              Draft by {draft.author ?? "staff"} · {fmtDateTime(draft.createdAt)}
            </span>
          )}
          {state?.error && <span className="text-[13px] text-s-accent">{state.error}</span>}
          {state?.ok && <span className="text-[13px] text-s-cyan">Draft saved</span>}
        </div>
      </form>
      {draft && role === "manager" && (
        <div className="rounded-xl border border-s-line p-3.5">
          <p className="text-sm font-medium">Manager review</p>
          <p className="mt-0.5 text-[12px] text-s-ink-3">Publishing makes the saved draft visible to the resident in My reports.</p>
          {clusterIds.length > 0 && (
            <label className="mt-2.5 flex items-start gap-2 text-[13px] text-s-ink-2">
              <input type="checkbox" className="mt-0.5 accent-[var(--s-accent)]" checked={applyCluster} onChange={(e) => setApplyCluster(e.target.checked)} />
              Also publish to the {clusterIds.length} related report(s) nearby in time ({clusterCodes.slice(0, 3).join(", ")}
              {clusterCodes.length > 3 ? "…" : ""})
            </label>
          )}
          <button
            className="s-btn s-btn-primary mt-3"
            disabled={publishing}
            onClick={() =>
              start(async () => {
                try {
                  setErr(null);
                  await publishResponse(reportId, applyCluster ? clusterIds : []);
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "Failed to publish");
                }
              })
            }
          >
            {publishing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Approve &amp; publish
          </button>
          {err && <p className="mt-2 text-[13px] text-s-accent">{err}</p>}
        </div>
      )}
      {draft && role !== "manager" && <p className="text-[12px] text-s-ink-3">A manager must review and publish this draft.</p>}
    </div>
  );
}
