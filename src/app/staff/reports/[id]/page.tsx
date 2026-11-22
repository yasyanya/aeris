import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleHelp, Lock, Mail, Phone, User } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { ensureWeather, staffReportDetail } from "@/lib/data";
import { characterLabel, durationLabel, intensityInfo, symptomLabel } from "@/lib/constants";
import { fmtDateTime, fmtKm, fmtTime } from "@/lib/format";
import { compass } from "@/lib/geo";
import { StaffStatusBadge, WindArrow } from "@/components/bits";
import { DetailMap, EntryForm, ResponsePanel, StatusControls, WeatherActions } from "./client";

export const metadata = { title: "Report" };

export default async function ReportDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  let d = staffReportDetail(id);
  if (!d) notFound();
  if (d.weather && d.weather.status !== "ok" && d.weather.attempts < 5) {
    await ensureWeather(id); // opportunistic retry
    d = staffReportDetail(id)!;
  }
  const user = (await currentUser())!;
  const { report: r, weather: w, screening, entries, responses, timeline, nearby, facilities } = d;
  const s = screening?.result ?? null;
  const verdictStyle =
    s?.verdict === "candidates" ? "border-s-accent/40 bg-s-accent/10" : s?.verdict === "none_fit" ? "border-s-cyan/40 bg-s-cyan/10" : "border-s-line bg-s-panel-2";

  return (
    <main className="mx-auto max-w-[1500px] px-6 py-6">
      <Link href="/staff/reports" className="inline-flex items-center gap-1.5 text-[13px] text-s-ink-3 hover:text-s-ink">
        <ArrowLeft className="size-4" /> Report queue
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-semibold tracking-wide">{r.receiptCode}</h1>
        <StaffStatusBadge status={r.status} />
        <span className="text-sm text-s-ink-3">
          Observed {fmtDateTime(r.observedAt)} · filed {fmtDateTime(r.createdAt)}
        </span>
        <div className="ml-auto">
          <StatusControls reportId={r.id} status={r.status} />
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        {/* ---------------- left column ---------------- */}
        <div className="space-y-5">
          <div className="s-card staff-map h-[440px] overflow-hidden">
            <DetailMap
              report={{ id: r.id, lat: r.lat, lon: r.lon, intensity: r.intensity }}
              nearby={nearby.map((n) => ({ id: n.id, lat: n.lat, lon: n.lon, intensity: n.intensity, label: `${n.receipt_code} · ${fmtTime(n.observed_at)}` }))}
              facilities={facilities}
              overlay={{
                reportId: r.id,
                lat: r.lat,
                lon: r.lon,
                fromDeg: s?.wind?.fromDeg ?? null,
                toleranceDeg: s?.toleranceDeg ?? null,
                trajectory: s?.trajectory ?? [],
              }}
              highlight={s?.candidates.filter((c) => c.level !== "nearby").map((c) => c.facilityId) ?? []}
              observedAt={r.observedAt}
            />
          </div>

          {/* Screening */}
          <section className={`rounded-2xl border p-5 ${verdictStyle}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="s-label">Possible-source screening</p>
                <h2 className="mt-1 text-lg font-semibold">{s?.headline ?? "Not screened yet"}</h2>
              </div>
              <WeatherActions reportId={r.id} weatherOk={w?.status === "ok"} />
            </div>
            {s && (
              <>
                {s.wind && (
                  <p className="mt-2 text-sm text-s-ink-2">
                    Wind from {s.wind.compass} ({Math.round(s.wind.fromDeg)}°) at {s.wind.speedMph.toFixed(1)} mph
                    {s.toleranceDeg != null && <> · upwind cone ±{s.toleranceDeg}° · up to 8 km · 3 h back-trajectory</>}
                  </p>
                )}
                {s.inconclusiveReasons.length > 0 && (
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {s.inconclusiveReasons.map((x) => (
                      <li key={x} className="flex gap-2">
                        <CircleHelp className="mt-0.5 size-4 shrink-0 text-s-ink-3" />
                        {x}
                      </li>
                    ))}
                  </ul>
                )}
                {s.candidates.length > 0 && (
                  <ul className="mt-4 space-y-2.5">
                    {s.candidates.map((c) => (
                      <li key={c.facilityId} className="rounded-xl bg-s-bg/60 p-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{c.name}</span>
                          <span
                            className={`badge ${c.level === "stronger" ? "bg-s-accent text-white" : c.level === "possible" ? "bg-s-accent/20 text-s-accent" : "bg-s-panel-2 text-s-ink-2"}`}
                          >
                            {c.level === "stronger" ? "Stronger fit" : c.level === "possible" ? "Possible" : "Nearby only"}
                          </span>
                          <span className="ml-auto text-[12px] text-s-ink-3">
                            {fmtKm(c.distanceM)} {compass(c.bearingFromObserver)}
                          </span>
                        </div>
                        <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[13px] text-s-ink-2">
                          {c.reasons.map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
                {s.indistinguishable.length > 0 && (
                  <p className="mt-3 flex gap-2 rounded-xl bg-s-bg/60 p-3 text-[13px] text-s-ink-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-s-accent" />
                    {s.indistinguishable
                      .map((g) => g.map((fid) => s.candidates.find((c) => c.facilityId === fid)?.name.split(" (")[0]).join(" and "))
                      .join("; ")}{" "}
                    lie in nearly the same direction from this location and cannot be told apart by wind alone. Use patrol
                    observations (odor character at each fence line) to distinguish them.
                  </p>
                )}
                <details className="mt-4 text-[13px] text-s-ink-2">
                  <summary className="cursor-pointer text-s-ink">Assumptions and missing information</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {s.assumptions.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                  {s.missing.length > 0 && (
                    <>
                      <p className="mt-3 text-s-ink">Missing / caveats</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {s.missing.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  <p className="mt-3 text-s-ink-3">
                    {nearby.length} other report(s) within 4 km and ±3 h{nearby.length ? " (grey points on the map)" : ""}. Computed{" "}
                    {screening && fmtDateTime(screening.computedAt)}.
                  </p>
                </details>
              </>
            )}
          </section>

          {/* Weather context */}
          <section className="s-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="s-label">Weather context</p>
                <h2 className="mt-1 font-semibold">
                  {w?.status === "ok" ? `Nearest hour ${w.sampleTime ? fmtTime(w.sampleTime) : ""}` : "Weather not attached"}
                </h2>
              </div>
              <span className="text-[12px] text-s-ink-3">
                {w?.source === "demo-synthetic" ? "Synthetic demo weather" : "Open-Meteo model estimate (~3 km grid)"}
              </span>
            </div>
            {w?.status !== "ok" ? (
              <p className="mt-3 rounded-xl bg-s-panel-2 p-3 text-sm text-s-ink-2">
                Retrieval failed{w?.error ? ` (${w.error})` : ""} after {w?.attempts ?? 0} attempt(s). The report is saved; screening is
                inconclusive until weather is attached. Use &ldquo;Retry weather&rdquo; above.
              </p>
            ) : (
              <>
                <dl className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6 text-sm">
                  {[
                    ["Temp", w.tempF != null ? `${Math.round(w.tempF)}°F` : "–"],
                    ["Humidity", w.rh != null ? `${Math.round(w.rh)}%` : "–"],
                    ["Pressure", w.pressureHpa != null ? `${w.pressureHpa.toFixed(0)} hPa` : "–"],
                    ["Cloud", w.cloudCover != null ? `${Math.round(w.cloudCover)}%` : "–"],
                    ["Precip", w.precipIn != null ? `${w.precipIn.toFixed(2)} in` : "–"],
                    ["Mixing height", w.blhM != null ? `${Math.round(w.blhM)} m` : "n/a"],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-s-panel-2 px-3 py-2">
                      <dt className="text-[11px] text-s-ink-3">{k}</dt>
                      <dd className="font-medium tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-center text-[13px]">
                    <thead className="text-[11px] text-s-ink-3">
                      <tr>
                        <th className="py-1.5 text-left font-medium">Hour</th>
                        {w.hours.map((h) => (
                          <th
                            key={h.t}
                            className={`py-1.5 font-medium ${Math.abs(Date.parse(h.t) - Date.parse(r.observedAt)) < 30 * 60_000 ? "text-s-cyan" : ""}`}
                          >
                            {fmtTime(h.t).replace(":00", "")}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-1.5 text-left text-s-ink-3">From</td>
                        {w.hours.map((h) => (
                          <td key={h.t}>
                            {h.windFromDeg != null && (h.windSpeedMph ?? 0) >= 2 ? (
                              <span className="inline-flex flex-col items-center">
                                <WindArrow fromDeg={h.windFromDeg} className="size-5" color="#3cc6e8" />
                                {compass(h.windFromDeg)}
                              </span>
                            ) : (
                              <span className="text-s-ink-3">calm</span>
                            )}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-1.5 text-left text-s-ink-3">mph</td>
                        {w.hours.map((h) => (
                          <td key={h.t} className="tabular-nums">
                            {h.windSpeedMph?.toFixed(1) ?? "–"}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-1.5 text-left text-s-ink-3">hPa</td>
                        {w.hours.map((h) => (
                          <td key={h.t} className="tabular-nums text-s-ink-2">
                            {h.pressureHpa?.toFixed(0) ?? "–"}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>

        {/* ---------------- right column ---------------- */}
        <div className="space-y-5">
          <section className="s-card p-5">
            <p className="s-label">Resident observation</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-[12px] text-s-ink-3">Intensity</dt>
                <dd className="flex items-center gap-2">
                  <span className="size-3 rounded-full" style={{ background: intensityInfo(r.intensity).color }} />
                  {r.intensity} · {intensityInfo(r.intensity).short} (TCEQ {intensityInfo(r.intensity).tceq})
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-s-ink-3">Duration</dt>
                <dd>
                  {durationLabel(r.duration)}
                  {r.ongoing && " · ongoing"}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[12px] text-s-ink-3">Character</dt>
                <dd>{r.characters.map((c) => (c === "other" && r.characterOther ? `Other: ${r.characterOther}` : characterLabel(c))).join(", ")}</dd>
              </div>
              {r.symptoms.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-[12px] text-s-ink-3">Effects</dt>
                  <dd>{r.symptoms.map(symptomLabel).join(", ")}</dd>
                </div>
              )}
              <div>
                <dt className="text-[12px] text-s-ink-3">Suspected source</dt>
                <dd>{r.suspectedSource ?? <span className="text-s-ink-3">Not given</span>}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-s-ink-3">Location</dt>
                <dd className="tabular-nums">
                  {r.lat.toFixed(5)}, {r.lon.toFixed(5)} <span className="text-s-ink-3">({r.locationMethod})</span>
                </dd>
              </div>
              {r.notes && (
                <div className="col-span-2">
                  <dt className="text-[12px] text-s-ink-3">Notes</dt>
                  <dd className="whitespace-pre-wrap">{r.notes}</dd>
                </div>
              )}
            </dl>
            <div className="mt-4 rounded-xl bg-s-panel-2 p-3 text-[13px]">
              {r.contact ? (
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  <span className="flex items-center gap-1.5">
                    <User className="size-3.5 text-s-ink-3" /> {r.contact.name ?? "–"}
                  </span>
                  {r.contact.email && (
                    <a href={`mailto:${r.contact.email}`} className="flex items-center gap-1.5 text-s-cyan">
                      <Mail className="size-3.5" /> {r.contact.email}
                    </a>
                  )}
                  {r.contact.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="size-3.5 text-s-ink-3" /> {r.contact.phone}
                    </span>
                  )}
                  <span className="w-full text-[11px] text-s-ink-3">Resident consented to be contacted about this report.</span>
                </div>
              ) : (
                <span className="flex items-center gap-2 text-s-ink-3">
                  <Lock className="size-3.5" /> No contact consent. Respond via the published response only.
                </span>
              )}
            </div>
          </section>

          <section className="s-card p-5">
            <p className="s-label">Investigation log · internal</p>
            <ol className="mt-3 space-y-3">
              {entries.length === 0 && <li className="text-sm text-s-ink-3">No patrol observations or checks yet.</li>}
              {entries.map((e) => (
                <li key={e.id} className="rounded-xl border border-s-line p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="badge bg-s-panel-2 text-s-ink-2">
                      {e.kind === "patrol" ? "Patrol" : e.kind === "operational" ? "Operational check" : "Note"}
                    </span>
                    <span className="text-s-ink-3">
                      {fmtDateTime(e.observedAt)} · {e.author}
                    </span>
                    {e.kind === "patrol" && e.odorDetected != null && (
                      <span className={`ml-auto badge ${e.odorDetected ? "bg-s-accent/20 text-s-accent" : "bg-s-cyan/15 text-s-cyan"}`}>
                        {e.odorDetected ? `Odor detected${e.intensity != null ? ` · ${intensityInfo(e.intensity).tceq}` : ""}` : "No odor"}
                      </span>
                    )}
                  </div>
                  {(e.locationText || e.windText || e.character) && (
                    <p className="mt-1.5 text-[12px] text-s-ink-3">
                      {[e.locationText, e.character && characterLabel(e.character), e.windText && `wind ${e.windText}`].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <p className="mt-1.5 text-s-ink-2">{e.notes}</p>
                </li>
              ))}
            </ol>
            <EntryForm reportId={r.id} defaultWind={s?.wind ? `${s.wind.compass} ${Math.round(s.wind.speedMph)} mph (model)` : ""} />
          </section>

          <section id="response" className="s-card scroll-mt-6 p-5">
            <p className="s-label">Response to resident</p>
            <ResponsePanel
              reportId={r.id}
              role={user.role}
              responses={responses}
              clusterIds={nearby.map((n) => n.id)}
              clusterCodes={nearby.map((n) => n.receipt_code)}
            />
          </section>

          <section className="s-card p-5">
            <p className="s-label">Activity</p>
            <ol className="mt-3 space-y-2.5 text-[13px]">
              {timeline.map((t, i) => (
                <li key={i} className="flex gap-2.5">
                  <CheckCircle2 className={`mt-0.5 size-4 shrink-0 ${t.isPublic ? "text-s-cyan" : "text-s-ink-3"}`} />
                  <span className="flex-1">
                    {t.message}
                    <span className="block text-[11px] text-s-ink-3">
                      {fmtDateTime(t.at)} · {t.isPublic ? "visible to resident" : "internal"}
                    </span>
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
