import Link from "next/link";
import { CloudOff } from "lucide-react";
import { staffReportList } from "@/lib/data";
import { characterLabel, INTENSITY, STATUSES } from "@/lib/constants";
import { fmtAgo, fmtDateTime } from "@/lib/format";
import { compass } from "@/lib/geo";
import { StaffStatusBadge } from "@/components/bits";

export const metadata = { title: "Report queue" };

export default async function Queue({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const status = sp.status ?? "open";
  const days = Number(sp.days ?? 30) || 30;
  const minIntensity = Number(sp.min ?? 0) || 0;
  const rows = staffReportList({ status, days, minIntensity, q: sp.q?.trim() || undefined });

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-7">
      <p className="s-label">Investigate</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Report queue</h1>

      <form className="s-card mt-5 flex flex-wrap items-end gap-3 p-4" action="/staff/reports">
        <label className="text-[12px] text-s-ink-3">
          Status
          <select name="status" defaultValue={status} className="s-input mt-1 w-44">
            <option value="open">Open (not responded)</option>
            <option value="all">All</option>
            {STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] text-s-ink-3">
          Period
          <select name="days" defaultValue={String(days)} className="s-input mt-1 w-36">
            <option value="1">Last 24 h</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="365">Last year</option>
          </select>
        </label>
        <label className="text-[12px] text-s-ink-3">
          Min. intensity
          <select name="min" defaultValue={String(minIntensity)} className="s-input mt-1 w-32">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "Any" : `${n}+`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 min-w-48 text-[12px] text-s-ink-3">
          Search
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Receipt code, odor type, suspected source" className="s-input mt-1" />
        </label>
        <button className="s-btn-primary s-btn">Apply</button>
      </form>

      <div className="s-card mt-4 overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-s-ink-3">
            <tr className="border-b border-s-line">
              <th className="px-5 py-3 font-medium">Report</th>
              <th className="py-3 font-medium">Observed</th>
              <th className="py-3 font-medium">Int.</th>
              <th className="py-3 font-medium">Odor</th>
              <th className="py-3 font-medium">Wind (model)</th>
              <th className="py-3 font-medium">Screening</th>
              <th className="py-3 pr-5 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-s-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-s-ink-3">
                  No reports match these filters.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="group hover:bg-s-panel-2">
                <td className="px-5 py-3">
                  <Link href={`/staff/reports/${r.id}`} className="font-mono text-[13px] text-s-ink group-hover:text-s-cyan">
                    {r.receiptCode}
                  </Link>
                  <span className="block text-[11px] text-s-ink-3">filed {fmtAgo(r.createdAt)}</span>
                </td>
                <td>{fmtDateTime(r.observedAt)}</td>
                <td>
                  <span
                    className="inline-flex size-7 items-center justify-center rounded-full text-[12px] font-semibold text-[#111418]"
                    style={{ background: INTENSITY[r.intensity].color }}
                  >
                    {r.intensity}
                  </span>
                </td>
                <td className="text-s-ink-2">{r.characters.map(characterLabel).join(", ")}</td>
                <td className="text-s-ink-2">
                  {r.weatherStatus !== "ok" ? (
                    <span className="inline-flex items-center gap-1.5 text-s-accent">
                      <CloudOff className="size-3.5" /> missing
                    </span>
                  ) : r.windSpeedMph != null && r.windFromDeg != null ? (
                    r.windSpeedMph < 2 ? (
                      "Calm"
                    ) : (
                      `${compass(r.windFromDeg)} ${Math.round(r.windSpeedMph)} mph`
                    )
                  ) : (
                    "–"
                  )}
                </td>
                <td className="text-s-ink-2">
                  {r.verdict === "candidates" ? (
                    <>
                      {r.topCandidate?.split(" (")[0]}
                      {r.candidateCount > 1 && <span className="text-s-ink-3"> +{r.candidateCount - 1}</span>}
                    </>
                  ) : r.verdict === "none_fit" ? (
                    <span className="text-s-ink-3">None upwind</span>
                  ) : (
                    <span className="text-s-ink-3">Inconclusive</span>
                  )}
                </td>
                <td className="pr-5 text-right">
                  <StaffStatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-s-ink-3">{rows.length} reports</p>
    </main>
  );
}
