import Link from "next/link";
import { ArrowRight, CloudOff } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { clusterAlerts, staffKpis, staffReportList } from "@/lib/data";
import { currentConditions } from "@/lib/conditions";
import { getDb } from "@/lib/db";
import { characterLabel, INTENSITY } from "@/lib/constants";
import { fmtAgo, fmtDateTime, fmtTime } from "@/lib/format";
import { compass } from "@/lib/geo";
import { StaffStatusBadge, WindArrow, windText } from "@/components/bits";

export const metadata = { title: "Dashboard" };

export default async function StaffDashboard() {
  const user = (await currentUser())!;
  const [k, alerts, cond] = [staffKpis(), clusterAlerts(), await currentConditions()];
  const week = staffReportList({ days: 7 });
  const attention = staffReportList({ status: "open" }).slice(0, 8);
  const hist = INTENSITY.map((i) => ({ ...i, n: week.filter((r) => r.intensity === i.value).length }));
  const maxH = Math.max(1, ...hist.map((h) => h.n));
  const verdicts = {
    candidates: week.filter((r) => r.verdict === "candidates").length,
    none_fit: week.filter((r) => r.verdict === "none_fit").length,
    inconclusive: week.filter((r) => r.verdict === "inconclusive").length,
  };
  const drafts = getDb()
    .prepare(
      `SELECT p.report_id, r.receipt_code, p.created_at, u.name author FROM responses p JOIN reports r ON r.id=p.report_id
       LEFT JOIN users u ON u.id=p.author_id WHERE p.status='draft' ORDER BY p.created_at DESC LIMIT 6`,
    )
    .all() as { report_id: number; receipt_code: string; created_at: string; author: string }[];

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="s-label">Staff console · {user.role}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Welcome back, {user.name.split(" ")[0]}</h1>
        </div>
        <div className="s-card flex items-center gap-3 px-4 py-2.5">
          {cond.now?.windFromDeg != null ? <WindArrow fromDeg={cond.now.windFromDeg} className="size-6" color="#3cc6e8" /> : <CloudOff className="size-5 text-s-ink-3" />}
          <div className="leading-tight">
            <p className="text-sm font-medium">{cond.now ? windText(cond.now.windSpeedMph, cond.now.windFromDeg) : "Weather unavailable"}</p>
            <p className="text-[11px] text-s-ink-3">
              {cond.now ? `Model estimate · ${fmtTime(cond.now.t)} · ${cond.hint.reasons[0]}` : cond.error}
            </p>
          </div>
        </div>
      </div>

      {alerts.length > 0 && (
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          {alerts.slice(0, 2).map((a, i) => (
            <div key={i} className="flex flex-wrap items-center gap-6 rounded-2xl bg-white p-5 text-[#111418] shadow-xl">
              <div>
                <p className="flex items-center gap-2 text-lg font-semibold text-s-accent">
                  Odor event detected
                  <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
                    <path d="M7 20c-2-3 2-5 0-8s2-5 0-8M12 20c-2-3 2-5 0-8s2-5 0-8M17 20c-2-3 2-5 0-8s2-5 0-8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </p>
                <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">{fmtTime(a.end)}</p>
              </div>
              <div className="min-w-48 flex-1">
                <p className="text-[15px] leading-snug">
                  {a.ids.length} community reports rated 3+ within an hour and 2 km of each other (max intensity {a.maxIntensity}).
                  Further investigation recommended.
                </p>
                <Link href={`/staff/map?ids=${a.ids.join(",")}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-s-accent">
                  Open in analysis map <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Reports, last 24 h", k.last24],
          ["New, not reviewed", k.newUnreviewed],
          ["Under review / investigating", k.investigating],
          ["Drafts awaiting manager", k.drafts],
          ["Median time to first update", k.medianFirstResponseHrs == null ? "–" : `${k.medianFirstResponseHrs.toFixed(1)} h`],
          ["Weather still missing", k.weatherFailed],
        ].map(([l, v]) => (
          <div key={l as string} className="s-card p-4">
            <p className="text-[12px] text-s-ink-3">{l}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="s-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-s-line px-5 py-4">
            <h2 className="font-semibold">Needs attention</h2>
            <Link href="/staff/reports?status=open" className="text-[13px] text-s-cyan">
              Open queue →
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-s-ink-3">
              <tr>
                <th className="px-5 py-2.5 font-medium">Observed</th>
                <th className="py-2.5 font-medium">Int.</th>
                <th className="py-2.5 font-medium hidden md:table-cell">Odor</th>
                <th className="py-2.5 font-medium hidden lg:table-cell">Wind</th>
                <th className="py-2.5 font-medium">Screen</th>
                <th className="py-2.5 pr-5 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-s-line">
              {attention.map((r) => (
                <tr key={r.id} className="hover:bg-s-panel-2">
                  <td className="px-5 py-3">
                    <Link href={`/staff/reports/${r.id}`} className="block">
                      <span className="font-mono text-[12px] text-s-ink-3">{r.receiptCode}</span>
                      <span className="block">{fmtDateTime(r.observedAt)}</span>
                    </Link>
                  </td>
                  <td>
                    <span className="inline-flex size-7 items-center justify-center rounded-full text-[12px] font-semibold text-[#111418]" style={{ background: INTENSITY[r.intensity].color }}>
                      {r.intensity}
                    </span>
                  </td>
                  <td className="hidden md:table-cell text-s-ink-2">{r.characters.map(characterLabel).join(", ")}</td>
                  <td className="hidden lg:table-cell text-s-ink-2">
                    {r.windSpeedMph != null && r.windFromDeg != null ? `${compass(r.windFromDeg)} ${Math.round(r.windSpeedMph)} mph` : "–"}
                  </td>
                  <td className="text-s-ink-2">
                    {r.verdict === "candidates" ? r.topCandidate?.split(" (")[0] : r.verdict === "none_fit" ? "None upwind" : "Inconclusive"}
                  </td>
                  <td className="pr-5 text-right">
                    <StaffStatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-5">
          <div className="s-card p-5">
            <h2 className="font-semibold">Intensity, last 7 days</h2>
            <p className="text-[12px] text-s-ink-3">{week.length} reports</p>
            <div className="mt-4 flex h-28 items-end gap-2" role="img" aria-label={hist.map((h) => `${h.value}: ${h.n}`).join(", ")}>
              {hist.map((h) => (
                <div key={h.value} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[11px] tabular-nums text-s-ink-2">{h.n}</span>
                  <span className="w-full rounded-t-md" style={{ height: `${(h.n / maxH) * 80 + 2}px`, background: h.color }} />
                  <span className="text-[11px] text-s-ink-3">{h.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-[12px]">
              <div className="rounded-lg bg-s-panel-2 py-2">
                <p className="text-lg font-semibold">{verdicts.candidates}</p>
                <p className="text-s-ink-3">source fits wind</p>
              </div>
              <div className="rounded-lg bg-s-panel-2 py-2">
                <p className="text-lg font-semibold">{verdicts.none_fit}</p>
                <p className="text-s-ink-3">none upwind</p>
              </div>
              <div className="rounded-lg bg-s-panel-2 py-2">
                <p className="text-lg font-semibold">{verdicts.inconclusive}</p>
                <p className="text-s-ink-3">inconclusive</p>
              </div>
            </div>
          </div>
          <div className="s-card p-5">
            <h2 className="font-semibold">Response drafts</h2>
            <p className="text-[12px] text-s-ink-3">{user.role === "manager" ? "Review and publish" : "Waiting for a manager to publish"}</p>
            <ul className="mt-3 divide-y divide-s-line">
              {drafts.length === 0 && <li className="py-3 text-sm text-s-ink-3">No drafts waiting.</li>}
              {drafts.map((d) => (
                <li key={d.report_id}>
                  <Link href={`/staff/reports/${d.report_id}#response`} className="flex items-center justify-between py-2.5 text-sm hover:text-s-cyan">
                    <span>
                      <span className="font-mono text-[12px]">{d.receipt_code}</span>
                      <span className="block text-[12px] text-s-ink-3">
                        by {d.author} · {fmtAgo(d.created_at)}
                      </span>
                    </span>
                    <ArrowRight className="size-4" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
