"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, TriangleAlert } from "lucide-react";
import type { StaffReportRow } from "@/lib/data";
import { characterLabel, intensityInfo } from "@/lib/constants";
import { fmtAgo, fmtDateTime, fmtKm } from "@/lib/format";
import { IntensityPill, StatusBadge, WindArrow, windText } from "@/components/bits";
import type { Fac } from "@/components/map/StaffLeaflet";

const StaffLeaflet = dynamic(() => import("@/components/map/StaffLeaflet"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-2" />,
});

type Alert = { ids: number[]; start: string; end: string; maxIntensity: number } | null;

const OPEN = ["received", "under_review", "investigating"];

const odorTitle = (r: StaffReportRow) => {
  const s = r.characters.map(characterLabel).join(", ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const likelySource = (r: StaffReportRow) => {
  const sc = r.screening;
  if (!sc) return "Not screened yet";
  if (sc.verdict === "inconclusive") return "Unclear (calm or missing wind)";
  if (sc.verdict === "none_fit") return "No listed facility upwind";
  const names = sc.candidates.map((c) => c.name.split(" (")[0]);
  return names.length > 1 ? `${names[0]} or ${names.length - 1} other` : names[0];
};

export default function StaffInbox({
  rows,
  facilities,
  alert,
  userName,
}: {
  rows: StaffReportRow[];
  facilities: Fac[];
  alert: Alert;
  userName: string;
}) {
  const [tab, setTab] = useState<"open" | "answered">("open");
  const open = useMemo(() => rows.filter((r) => OPEN.includes(r.status)), [rows]);
  const answered = useMemo(() => rows.filter((r) => !OPEN.includes(r.status)), [rows]);
  const list = tab === "open" ? open : answered;
  const [selectedId, setSelectedId] = useState<number | null>(open[0]?.id ?? null);
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex h-[calc(100vh-24px)] gap-3 max-md:h-screen">
      {/* ---------- list panel ---------- */}
      <section className="card flex w-full flex-col overflow-hidden md:w-[400px] md:shrink-0">
        <header className="px-5 pb-4 pt-5">
          <div className="flex items-center justify-between text-[13px] text-ink-3">
            <span>Hi {userName}</span>
            <form action="/api/auth/logout" method="post" className="md:hidden">
              <button className="hover:text-ink">Sign out</button>
            </form>
          </div>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight">Odor reports</h1>
          <div className="segmented mt-4" role="tablist">
            <button role="tab" aria-selected={tab === "open"} onClick={() => setTab("open")}>
              Needs action · {open.length}
            </button>
            <button role="tab" aria-selected={tab === "answered"} onClick={() => setTab("answered")}>
              Answered
            </button>
          </div>
        </header>

        {alert && tab === "open" && (
          <button
            onClick={() => setSelectedId(alert.ids[alert.ids.length - 1])}
            className="mx-5 mb-3 flex items-start gap-3 rounded-2xl bg-warn-soft px-4 py-3 text-left"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
            <span className="text-[13px] leading-snug">
              <span className="font-medium text-warn">Possible odor event</span>
              <span className="block text-ink-2">
                {alert.ids.length} strong reports within an hour, close together ({fmtAgo(alert.end)}).
              </span>
            </span>
          </button>
        )}

        <ul className="flex-1 space-y-2 overflow-y-auto px-5 pb-5">
          {list.length === 0 && <li className="py-10 text-center text-sm text-ink-3">Nothing here. Nice work.</li>}
          {list.map((r) => {
            const sel = r.id === selectedId;
            return (
              <li key={r.id}>
                <div
                  className={`rounded-2xl transition ${sel ? "border border-ink bg-surface" : "border border-transparent bg-surface-2 hover:border-line"}`}
                >
                  <button onClick={() => setSelectedId(sel ? null : r.id)} className="w-full px-4 py-3.5 text-left">
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{odorTitle(r)}</span>
                        <span className="mt-0.5 block text-[13px] text-ink-3">
                          {fmtDateTime(r.observedAt)} · {r.place}
                        </span>
                      </span>
                      <StatusBadge status={r.status} />
                    </span>
                  </button>
                  {sel && (
                    <div className="space-y-3 px-4 pb-4">
                      <div className="h-1 rounded-full bg-line">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${{ received: 15, under_review: 35, investigating: 65, responded: 100, closed: 100 }[r.status] ?? 10}%` }}
                        />
                      </div>
                      <dl className="grid grid-cols-3 gap-3 text-[13px]">
                        <div>
                          <dt className="text-ink-3">Intensity</dt>
                          <dd className="mt-0.5 font-medium">
                            {r.intensity} · {intensityInfo(r.intensity).short}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ink-3">Wind (est.)</dt>
                          <dd className="mt-0.5 font-medium">{r.weatherStatus === "ok" ? windText(r.windSpeedMph, r.windFromDeg).replace("From ", "") : "Missing"}</dd>
                        </div>
                        <div>
                          <dt className="text-ink-3">Filed</dt>
                          <dd className="mt-0.5 font-medium">{fmtAgo(r.createdAt)}</dd>
                        </div>
                      </dl>
                      <Link href={`/staff/reports/${r.id}`} className="btn btn-primary btn-sm w-full">
                        Open report <ArrowRight className="size-4" />
                      </Link>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---------- map + detail card ---------- */}
      <section className="relative hidden flex-1 overflow-hidden rounded-[20px] border border-line/60 shadow-card md:block">
        <StaffLeaflet
          points={list.map((r) => ({ id: r.id, lat: r.lat, lon: r.lon, intensity: r.intensity, label: `${odorTitle(r)} · ${fmtDateTime(r.observedAt)}` }))}
          facilities={facilities}
          selectedId={selectedId}
          trajectory={selected?.screening?.trajectory ?? []}
          highlightFacilities={selected?.screening?.candidates.map((c) => c.facilityId) ?? []}
          onSelect={(id) => setSelectedId(id)}
        />
        {selected && (
          <div className="card absolute inset-x-4 bottom-4 z-[500] overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
              <h2 className="font-semibold">{odorTitle(selected)}</h2>
              <StatusBadge status={selected.status} />
              <Link href={`/staff/reports/${selected.id}`} className="btn btn-ghost btn-sm ml-auto">
                Open report
              </Link>
            </div>
            <dl className="grid grid-cols-2 gap-4 px-5 py-4 text-sm lg:grid-cols-5">
              <div>
                <dt className="text-[12px] text-ink-3">Observed</dt>
                <dd className="mt-0.5">{fmtDateTime(selected.observedAt)}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-ink-3">Where</dt>
                <dd className="mt-0.5">{selected.place}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-ink-3">Intensity</dt>
                <dd className="mt-0.5">
                  <IntensityPill value={selected.intensity} />
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-ink-3">Wind (estimate)</dt>
                <dd className="mt-0.5 flex items-center gap-1.5">
                  {selected.windFromDeg != null && selected.weatherStatus === "ok" && <WindArrow fromDeg={selected.windFromDeg} className="size-4" />}
                  {selected.weatherStatus === "ok" ? windText(selected.windSpeedMph, selected.windFromDeg) : "Not available"}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-ink-3">Likely source</dt>
                <dd className="mt-0.5">
                  {likelySource(selected)}
                  {selected.screening?.candidates[0] && (
                    <span className="block text-[12px] text-ink-3">{fmtKm(selected.screening.candidates[0].distanceM)} upwind</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
        )}
        <div className="absolute left-4 top-4 z-[500] rounded-full bg-surface/90 px-3 py-1.5 text-[12px] text-ink-2 shadow-card backdrop-blur">
          Dashed line = where the air came from (estimate)
        </div>
      </section>
    </div>
  );
}
