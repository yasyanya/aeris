import { Check, CircleDot, MessageSquareText } from "lucide-react";
import type { ResidentReportView } from "@/lib/data";
import { characterLabel, durationLabel, STATUSES } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { IntensityPill, StatusBadge, WindArrow, windText } from "./bits";

const STEPS = STATUSES.filter((s) => s.key !== "closed");

export function ReportCard({ r }: { r: ResidentReportView }) {
  const stepIdx = Math.max(0, STEPS.findIndex((s) => s.key === (r.status === "closed" ? "responded" : r.status)));
  const responded = r.responses.length > 0;
  return (
    <article className="card overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div className="mr-auto">
          <p className="font-mono text-[13px] text-ink-3">{r.receiptCode}</p>
          <p className="font-semibold">Odor observed {fmtDateTime(r.observedAt)}</p>
        </div>
        <StatusBadge status={r.status} />
      </header>

      <div className="grid gap-0 md:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4 px-5 py-5 sm:px-6">
          <div className="flex flex-wrap gap-2">
            <IntensityPill value={r.intensity} />
            {r.characters.map((c) => (
              <span key={c} className="rounded-full bg-surface-2 px-2.5 h-6 inline-flex items-center text-[12px]">
                {c === "other" && r.characterOther ? r.characterOther : characterLabel(c)}
              </span>
            ))}
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="label">Duration</dt>
              <dd>{durationLabel(r.duration)}</dd>
            </div>
            <div>
              <dt className="label">Wind at that time (estimate)</dt>
              <dd className="flex items-center gap-1.5">
                {r.weather.status === "ok" ? (
                  <>
                    {r.weather.fromDeg != null && <WindArrow fromDeg={r.weather.fromDeg} className="size-4" />}
                    {windText(r.weather.speedMph, r.weather.fromDeg)}
                  </>
                ) : (
                  <span className="text-ink-3">Pending; we&apos;ll retry automatically</span>
                )}
              </dd>
            </div>
            {r.suspectedSource && (
              <div className="col-span-2">
                <dt className="label">Your suspected source</dt>
                <dd>{r.suspectedSource}</dd>
              </div>
            )}
          </dl>
          {/* progress rail */}
          <ol className="flex items-center gap-1.5 pt-2" aria-label="Report progress">
            {STEPS.map((s, i) => (
              <li key={s.key} className="flex-1">
                <span className={`block h-1.5 rounded-full ${i <= stepIdx ? "bg-primary" : "bg-line"}`} />
                <span className={`mt-1.5 block text-[11px] leading-tight ${i <= stepIdx ? "text-ink" : "text-ink-3"}`}>{s.label}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="border-t md:border-t-0 md:border-l border-line bg-surface-2/50 px-5 py-5 sm:px-6">
          <h3 className="eyebrow">Timeline</h3>
          <ol className="mt-3 space-y-4">
            {r.timeline.map((e, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
                    e.type === "responded" ? "bg-ink text-surface" : "bg-primary-soft text-primary"
                  }`}
                >
                  {e.type === "responded" ? <MessageSquareText className="size-3.5" /> : i === r.timeline.length - 1 && !responded ? <CircleDot className="size-3.5" /> : <Check className="size-3.5" />}
                </span>
                <div>
                  <p className="text-sm">{e.message}</p>
                  <p className="text-[12px] text-ink-3">{fmtDateTime(e.at)}</p>
                </div>
              </li>
            ))}
          </ol>
          {r.responses.map((p, i) => (
            <div key={i} className="mt-5 rounded-2xl bg-surface p-4 border border-line">
              <p className="eyebrow">Response from NTMWD staff</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{p.body}</p>
              <p className="mt-2 text-[12px] text-ink-3">Published {fmtDateTime(p.publishedAt)}</p>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
