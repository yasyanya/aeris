import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, Mail, Phone } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { addTimeline } from "@/lib/reports-core";
import { ensureWeather, staffReportDetail } from "@/lib/data";
import { characterLabel, durationLabel, intensityInfo, symptomLabel } from "@/lib/constants";
import { fmtDateTime, fmtKm, fmtTime } from "@/lib/format";
import { compass, describePlace } from "@/lib/geo";
import { IntensityPill, StatusBadge, WindArrow, windText } from "@/components/bits";
import { DetailMap, NoteForm, ResponsePanel } from "./client";

export const metadata = { title: "Report" };

export default async function ReportDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  let d = staffReportDetail(id);
  if (!d) notFound();
  // Opening a new report marks it as "under review" for the resident.
  if (d.report.status === "received") {
    const db = getDb();
    db.prepare("UPDATE reports SET status='under_review' WHERE id=?").run(id);
    addTimeline(db, id, "under_review", "A staff member is reviewing your report.", true);
  }
  // Weather that failed earlier is retried automatically.
  if (d.weather && d.weather.status !== "ok" && d.weather.attempts < 5) await ensureWeather(id);
  d = staffReportDetail(id)!;

  const user = (await currentUser())!;
  const { report: r, weather: w, screening, entries, responses, timeline, nearby, facilities } = d;
  const s = screening?.result ?? null;
  const fits = s?.candidates.filter((c) => c.level !== "nearby") ?? [];
  const title = r.characters.map((c) => (c === "other" && r.characterOther ? r.characterOther : characterLabel(c))).join(", ");

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-4 md:px-2 md:py-2">
      <Link href="/staff" className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" /> All reports
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{title.charAt(0).toUpperCase() + title.slice(1)}</h1>
        <StatusBadge status={r.status} />
        <span className="text-[13px] text-ink-3">
          {fmtDateTime(r.observedAt)} · {describePlace(r.lat, r.lon)} · <span className="font-mono">{r.receiptCode}</span>
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {/* ---------- left ---------- */}
        <div className="space-y-4">
          <div className="card h-[360px] overflow-hidden p-0">
            <DetailMap
              report={{ id: r.id, lat: r.lat, lon: r.lon, intensity: r.intensity }}
              nearby={nearby.map((n) => ({ id: n.id, lat: n.lat, lon: n.lon, intensity: n.intensity, label: `Other report · ${fmtTime(n.observed_at)}` }))}
              facilities={facilities}
              trajectory={s?.trajectory ?? []}
              highlight={fits.map((c) => c.facilityId)}
            />
          </div>

          <section className="card p-5">
            <p className="label">Likely source</p>
            <h2 className="mt-1 font-semibold">{s?.headline ?? "Not screened yet"}</h2>
            {fits.length > 0 && (
              <ul className="mt-3 divide-y divide-line">
                {fits.map((c) => (
                  <li key={c.facilityId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span>{c.name}</span>
                    <span className="flex items-center gap-2 text-[13px] text-ink-3">
                      {fmtKm(c.distanceM)} {compass(c.bearingFromObserver)}
                      <span className={`badge ${c.level === "stronger" ? "bg-primary-soft text-primary" : "bg-surface-2 text-ink-2"}`}>
                        {c.level === "stronger" ? "Good fit" : "Possible"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {s && s.inconclusiveReasons.length > 0 && <p className="mt-2 text-sm text-ink-2">{s.inconclusiveReasons[0]}</p>}
            {s && s.indistinguishable.length > 0 && (
              <p className="mt-2 text-[13px] text-ink-2">These sit in nearly the same direction, so wind alone can&apos;t tell them apart. Check on site.</p>
            )}
            {s && (
              <details className="mt-3 text-[13px] text-ink-2">
                <summary className="cursor-pointer text-ink-3 hover:text-ink">How this was worked out</summary>
                <p className="mt-2">
                  We compared the wind at that time with the direction of each facility (±{s.toleranceDeg ?? 22.5}°, up to 8 km) and traced the
                  air back about 3 hours (dashed line on the map). It&apos;s a guide for where to look, not proof.
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {s.assumptions.slice(0, 3).map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <section className="card p-5">
            <p className="label">Weather at that time (estimate)</p>
            {w?.status === "ok" ? (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    {w.fromDeg != null && <WindArrow fromDeg={w.fromDeg} className="size-5" />}
                    {windText(w.speedMph, w.fromDeg)}
                  </span>
                  {w.tempF != null && <span className="text-ink-2">{Math.round(w.tempF)}°F</span>}
                  {w.rh != null && <span className="text-ink-2">{Math.round(w.rh)}% humidity</span>}
                  {w.precipIn != null && w.precipIn > 0 && <span className="text-ink-2">Rain</span>}
                </div>
                <div className="mt-4 flex gap-1.5 overflow-x-auto">
                  {w.hours.map((h) => {
                    const now = Math.abs(Date.parse(h.t) - Date.parse(r.observedAt)) < 30 * 60_000;
                    return (
                      <div key={h.t} className={`min-w-14 flex-1 rounded-xl py-2 text-center ${now ? "bg-ink text-surface" : "bg-surface-2"}`}>
                        <p className={`text-[11px] ${now ? "" : "text-ink-3"}`}>{fmtTime(h.t).replace(":00", "")}</p>
                        {h.windFromDeg != null && (h.windSpeedMph ?? 0) >= 2 ? (
                          <WindArrow fromDeg={h.windFromDeg} className="mx-auto my-1 size-4" color={now ? "currentColor" : "var(--wind)"} />
                        ) : (
                          <p className="my-1 text-[11px]">calm</p>
                        )}
                        <p className="text-[12px] font-medium">{h.windSpeedMph != null ? Math.round(h.windSpeedMph) : "–"}</p>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-ink-2">Weather couldn&apos;t be retrieved yet. It&apos;s retried automatically.</p>
            )}
          </section>
        </div>

        {/* ---------- right ---------- */}
        <div className="space-y-4">
          <section className="card p-5">
            <p className="label">What the resident reported</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <IntensityPill value={r.intensity} />
              <span className="inline-flex h-6 items-center rounded-full bg-surface-2 px-2.5 text-[12px]">
                {r.duration === "unknown" ? "Duration not sure" : durationLabel(r.duration)}
                {r.ongoing && " · still happening"}
              </span>
            </div>
            <dl className="mt-4 space-y-2.5 text-sm">
              {r.symptoms.length > 0 && (
                <div className="flex gap-3">
                  <dt className="w-28 shrink-0 text-ink-3">Effects</dt>
                  <dd>{r.symptoms.map(symptomLabel).join(", ")}</dd>
                </div>
              )}
              <div className="flex gap-3">
                <dt className="w-28 shrink-0 text-ink-3">Thinks it&apos;s from</dt>
                <dd>{r.suspectedSource ?? <span className="text-ink-3">Not given</span>}</dd>
              </div>
              {r.notes && (
                <div className="flex gap-3">
                  <dt className="w-28 shrink-0 text-ink-3">Notes</dt>
                  <dd className="whitespace-pre-wrap">{r.notes}</dd>
                </div>
              )}
              <div className="flex gap-3">
                <dt className="w-28 shrink-0 text-ink-3">Intensity scale</dt>
                <dd>TCEQ {intensityInfo(r.intensity).tceq}</dd>
              </div>
            </dl>
            <div className="mt-4 rounded-xl bg-surface-2 px-3.5 py-3 text-[13px]">
              {r.contact ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="text-ink-3">OK to contact:</span>
                  {r.contact.name && <span>{r.contact.name}</span>}
                  {r.contact.email && (
                    <a href={`mailto:${r.contact.email}`} className="flex items-center gap-1 text-primary">
                      <Mail className="size-3.5" /> {r.contact.email}
                    </a>
                  )}
                  {r.contact.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="size-3.5" /> {r.contact.phone}
                    </span>
                  )}
                </div>
              ) : (
                <span className="flex items-center gap-2 text-ink-3">
                  <Lock className="size-3.5" /> Anonymous. Reply through the published response.
                </span>
              )}
            </div>
          </section>

          <section className="card p-5">
            <p className="label">Investigation notes</p>
            <ul className="mt-3 space-y-2.5">
              {entries.length === 0 && <li className="text-sm text-ink-3">No notes yet.</li>}
              {entries.map((e) => (
                <li key={e.id} className="rounded-xl bg-surface-2 px-3.5 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
                    {e.author} · {fmtDateTime(e.observedAt)}
                    {e.odorDetected != null && (
                      <span className={`badge ml-auto ${e.odorDetected ? "bg-warn-soft text-warn" : "bg-primary-soft text-primary"}`}>
                        {e.odorDetected ? "Odor confirmed" : "No odor found"}
                      </span>
                    )}
                  </div>
                  <p className="mt-1">{e.notes}</p>
                </li>
              ))}
            </ul>
            <NoteForm reportId={r.id} />
          </section>

          <section id="response" className="card scroll-mt-4 p-5">
            <p className="label">Response to the resident</p>
            <ResponsePanel reportId={r.id} role={user.role} responses={responses} />
          </section>

          <section className="card p-5">
            <p className="label">What the resident sees</p>
            <ol className="mt-3 space-y-2 text-[13px]">
              {timeline
                .filter((t) => t.isPublic)
                .map((t, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>
                      {t.message} <span className="text-ink-3">· {fmtDateTime(t.at)}</span>
                    </span>
                  </li>
                ))}
            </ol>
          </section>
        </div>
      </div>
    </main>
  );
}
