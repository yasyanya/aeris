"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Crosshair, Loader2, Lock, MapPin, Pencil, Search } from "lucide-react";
import { CHARACTERS, DURATIONS, INTENSITY, SYMPTOMS, characterLabel, durationLabel, symptomLabel, intensityInfo } from "@/lib/constants";
import { fmtDateTime, fromLocalInput, toLocalInput } from "@/lib/format";

const PinPickerMap = dynamic(() => import("@/components/map/PinPickerMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-2" />,
});

type Fac = { id: number; name: string; type: string; lat: number; lon: number };
type Pt = { lat: number; lon: number };

const STEPS = ["Where", "When", "What", "Review"] as const;

export default function ReportWizard({ facilities }: { facilities: Fac[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pt, setPt] = useState<Pt | null>(null);
  const [method, setMethod] = useState<"device" | "pin" | "search">("pin");
  const [fly, setFly] = useState<Pt | null>(null);
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ label: string; lat: number; lon: number }[]>([]);
  const [searching, setSearching] = useState(false);

  const [when, setWhenRaw] = useState(() => toLocalInput(new Date()));
  // "now" is captured when the time changes, so validation stays pure during render.
  const [nowMs, setNowMs] = useState(() => Date.now());
  const setWhen = (v: string) => {
    setNowMs(Date.now());
    setWhenRaw(v);
  };
  const [duration, setDuration] = useState<string>("unknown");
  const [ongoing, setOngoing] = useState(true);
  const [intensity, setIntensity] = useState<number | null>(null);
  const [chars, setChars] = useState<string[]>([]);
  const [charOther, setCharOther] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [suspected, setSuspected] = useState("");
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = useCallback((p: Pt) => {
    setPt(p);
    setMethod("pin");
  }, []);

  const useDevice = () => {
    setLocMsg(null);
    if (!("geolocation" in navigator)) return setLocMsg("Location isn't available on this device. Drop a pin instead.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setPt(p);
        setFly(p);
        setMethod("device");
        setLocating(false);
        if (pos.coords.accuracy > 200) setLocMsg(`Location is approximate (±${Math.round(pos.coords.accuracy)} m). Drag the pin if needed.`);
      },
      () => {
        setLocating(false);
        setLocMsg("We couldn't get your location. Tap the map to drop a pin.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const search = async () => {
    if (query.trim().length < 3) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results ?? []);
      if (data.error) setLocMsg(data.error);
      else if (!data.results?.length) setLocMsg("No matches near Melissa. Try a street name, or drop a pin.");
    } catch {
      setLocMsg("Address search is unavailable. Drop a pin on the map instead.");
    } finally {
      setSearching(false);
    }
  };

  const observedAt = useMemo(() => {
    try {
      return fromLocalInput(when);
    } catch {
      return null;
    }
  }, [when]);
  const whenError =
    !observedAt || Number.isNaN(observedAt.getTime())
      ? "Enter a valid date and time"
      : observedAt.getTime() > nowMs + 10 * 60_000
        ? "Time can't be in the future"
        : observedAt.getTime() < nowMs - 7 * 86_400_000
          ? "Reports can cover up to 7 days ago"
          : null;

  const canNext = [!!pt, !whenError, intensity != null && chars.length > 0 && (!chars.includes("other") || charOther.trim()), true][step];

  const toggle = (list: string[], set: (v: string[]) => void, k: string) => set(list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);

  const submit = async () => {
    if (!pt || intensity == null || !observedAt) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: pt.lat,
          lon: pt.lon,
          locationMethod: method,
          observedAt: observedAt.toISOString(),
          intensity,
          characters: chars,
          characterOther: chars.includes("other") ? charOther : null,
          duration,
          ongoing,
          symptoms,
          suspectedSource: suspected,
          notes,
          consentContact: consent,
          contactName: consent ? cName : null,
          contactEmail: consent ? cEmail : null,
          contactPhone: consent ? cPhone : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.issues?.[0]?.message ? `${data.error} ${data.issues[0].message}.` : (data.error ?? "Something went wrong."));
        setSubmitting(false);
        return;
      }
      router.push(`/report/receipt/${data.receiptCode}?w=${data.weatherStatus}`);
    } catch {
      setError("We couldn't reach the server. Check your connection and try again. Nothing was lost on this page.");
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">New odor report</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{["Where did you notice it?", "When, and for how long?", "What did it smell like?", "Review and send"][step]}</h1>
        </div>
        <p className="text-sm text-ink-3 shrink-0">
          Step {step + 1} of {STEPS.length}
        </p>
      </div>

      <ol className="mt-5 grid grid-cols-4 gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              disabled={i > step}
              onClick={() => setStep(i)}
              className="w-full text-left disabled:cursor-default"
              aria-current={i === step ? "step" : undefined}
            >
              <span className={`block h-1.5 rounded-full ${i <= step ? "bg-ink" : "bg-line"}`} />
              <span className={`mt-2 block text-[12px] ${i === step ? "text-ink font-medium" : "text-ink-3"}`}>{s}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="card mt-6 overflow-hidden">
        {step === 0 && (
          <div className="grid md:grid-cols-[320px_1fr]">
            <div className="space-y-4 p-5 sm:p-6 md:border-r border-line">
              <button type="button" onClick={useDevice} className="btn btn-primary w-full">
                {locating ? <Loader2 className="size-4 animate-spin" /> : <Crosshair className="size-4" />} Use my current location
              </button>
              <div className="relative">
                <label htmlFor="addr" className="label">
                  Or search an address
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    id="addr"
                    className="input"
                    placeholder="e.g. 3411 Barker Ave"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())}
                  />
                  <button type="button" onClick={search} className="icon-btn shrink-0 shadow-none" aria-label="Search address">
                    {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                  </button>
                </div>
                {results.length > 0 && (
                  <ul className="mt-2 overflow-hidden rounded-xl border border-line">
                    {results.map((r) => (
                      <li key={`${r.lat},${r.lon}`}>
                        <button
                          type="button"
                          className="w-full px-3 py-2.5 text-left text-sm hover:bg-surface-2"
                          onClick={() => {
                            const p = { lat: r.lat, lon: r.lon };
                            setPt(p);
                            setFly(p);
                            setMethod("search");
                            setResults([]);
                          }}
                        >
                          {r.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="text-sm text-ink-2">
                Or <strong>tap the map</strong> to drop a pin where you noticed the odor. You can drag it to adjust.
              </p>
              {locMsg && <p className="rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-ink-2">{locMsg}</p>}
              <div className="flex items-start gap-2.5 rounded-2xl bg-primary-soft p-3.5 text-[13px] text-ink-2">
                <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
                <p>
                  Your exact location is visible <strong>only to investigators</strong>. The public map shows areas of about half a
                  kilometre, and only once there are at least 3 reports.
                </p>
              </div>
              {pt && (
                <p className="flex items-center gap-1.5 text-[13px] text-ink-2">
                  <MapPin className="size-4 text-primary" /> Pin set ({pt.lat.toFixed(4)}, {pt.lon.toFixed(4)})
                </p>
              )}
            </div>
            <div className="h-[360px] md:h-[520px]">
              <PinPickerMap value={pt} onChange={pick} flyTarget={fly} facilities={facilities} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-7 p-5 sm:p-8">
            <div>
              <label htmlFor="when" className="font-medium">
                When did you notice it?
              </label>
              <p className="text-sm text-ink-3">Central time. Defaults to now; you can report up to 7 days back.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  id="when"
                  type="datetime-local"
                  className="input max-w-[260px]"
                  value={when}
                  max={toLocalInput(new Date())}
                  onChange={(e) => setWhen(e.target.value)}
                  aria-invalid={!!whenError}
                />
                {[0, 30, 60, 180].map((m) => (
                  <button key={m} type="button" className="chip" onClick={() => setWhen(toLocalInput(new Date(Date.now() - m * 60_000)))}>
                    {m === 0 ? "Now" : m < 60 ? `${m} min ago` : `${m / 60} h ago`}
                  </button>
                ))}
              </div>
              {whenError && <p className="mt-2 text-sm text-danger">{whenError}</p>}
            </div>
            <fieldset>
              <legend className="font-medium">
                About how long did it last? <span className="font-normal text-ink-3">(optional)</span>
              </legend>
              <p className="text-sm text-ink-3">If you just arrived or aren&apos;t sure, leave it as &ldquo;Not sure&rdquo;.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {DURATIONS.map((d) => (
                  <label key={d.key} className="chip">
                    <input type="radio" name="duration" className="sr-only" checked={duration === d.key} onChange={() => setDuration(d.key)} />
                    {d.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="font-medium">Is it still happening?</legend>
              <div className="mt-3 flex gap-2">
                {[
                  [true, "Yes, still noticeable"],
                  [false, "No, it has stopped"],
                ].map(([v, l]) => (
                  <label key={String(v)} className="chip">
                    <input type="radio" name="ongoing" className="sr-only" checked={ongoing === v} onChange={() => setOngoing(v as boolean)} />
                    {l as string}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-7 p-5 sm:p-8">
            <fieldset>
              <legend className="font-medium">How strong was it?</legend>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {INTENSITY.map((i) => (
                  <label
                    key={i.value}
                    className={`cursor-pointer rounded-2xl border p-3 transition ${intensity === i.value ? "border-ink bg-surface-2 ring-1 ring-ink" : "border-line hover:border-ink-3"}`}
                  >
                    <input type="radio" name="intensity" className="sr-only" checked={intensity === i.value} onChange={() => setIntensity(i.value)} />
                    <span className="flex items-center gap-2">
                      <span className="size-4 rounded-full" style={{ background: i.color }} />
                      <span className="text-lg font-semibold">{i.value}</span>
                    </span>
                    <span className="mt-1 block text-[13px] leading-tight text-ink-2">{i.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="font-medium">What did it smell like?</legend>
              <p className="text-sm text-ink-3">Choose all that apply.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {CHARACTERS.map((c) => (
                  <label key={c.key} className="chip">
                    <input type="checkbox" className="sr-only" checked={chars.includes(c.key)} onChange={() => toggle(chars, setChars, c.key)} />
                    {chars.includes(c.key) && <Check className="size-3.5" />}
                    {c.label}
                  </label>
                ))}
              </div>
              {chars.includes("other") && (
                <input
                  className="input mt-3 max-w-md"
                  placeholder="Describe the smell"
                  value={charOther}
                  maxLength={120}
                  onChange={(e) => setCharOther(e.target.value)}
                />
              )}
            </fieldset>
            <fieldset>
              <legend className="font-medium">
                Did it affect you? <span className="font-normal text-ink-3">(optional)</span>
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {SYMPTOMS.map((s) => (
                  <label key={s.key} className="chip">
                    <input type="checkbox" className="sr-only" checked={symptoms.includes(s.key)} onChange={() => toggle(symptoms, setSymptoms, s.key)} />
                    {symptoms.includes(s.key) && <Check className="size-3.5" />}
                    {s.label}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-ink-3">For a medical emergency call 911. This app is not monitored in real time.</p>
            </fieldset>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="suspected" className="font-medium">
                  Suspected source <span className="font-normal text-ink-3">(optional)</span>
                </label>
                <input
                  id="suspected"
                  className="input mt-2"
                  list="sources"
                  placeholder="Not sure is fine"
                  value={suspected}
                  maxLength={120}
                  onChange={(e) => setSuspected(e.target.value)}
                />
                <datalist id="sources">
                  {["Landfill", "Compost site", "Feedlot / livestock", "Wastewater plant", "Not sure"].map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div>
                <label htmlFor="notes" className="font-medium">
                  Anything else? <span className="font-normal text-ink-3">(optional)</span>
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  maxLength={1000}
                  className="input mt-2 h-auto py-2.5"
                  placeholder="e.g. stronger near the creek, started after rain"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && pt && intensity != null && observedAt && (
          <div className="grid gap-0 md:grid-cols-[1.2fr_1fr]">
            <div className="p-5 sm:p-8 md:border-r border-line">
              <p className="text-sm text-ink-3">Check your answers. Tap Edit to change anything.</p>
              <dl className="mt-4 divide-y divide-line">
                <Row label="Location" onEdit={() => setStep(0)}>
                  {method === "device" ? "Device location" : method === "search" ? "Address search" : "Map pin"} · {pt.lat.toFixed(4)},{" "}
                  {pt.lon.toFixed(4)}
                </Row>
                <Row label="Observed" onEdit={() => setStep(1)}>
                  {fmtDateTime(observedAt)} · {duration === "unknown" ? "duration not sure" : durationLabel(duration)} · {ongoing ? "still happening" : "stopped"}
                </Row>
                <Row label="Intensity" onEdit={() => setStep(2)}>
                  <span className="inline-flex items-center gap-2">
                    <span className="size-3 rounded-full" style={{ background: intensityInfo(intensity).color }} />
                    {intensity} · {intensityInfo(intensity).label}
                  </span>
                </Row>
                <Row label="Smelled like" onEdit={() => setStep(2)}>
                  {chars.map((c) => (c === "other" ? `Other: ${charOther}` : characterLabel(c))).join(", ")}
                </Row>
                {symptoms.length > 0 && (
                  <Row label="Effects" onEdit={() => setStep(2)}>
                    {symptoms.map(symptomLabel).join(", ")}
                  </Row>
                )}
                {suspected && (
                  <Row label="Suspected source" onEdit={() => setStep(2)}>
                    {suspected}
                  </Row>
                )}
                {notes && (
                  <Row label="Notes" onEdit={() => setStep(2)}>
                    {notes}
                  </Row>
                )}
              </dl>
            </div>
            <div className="space-y-4 p-5 sm:p-8 bg-surface-2/60">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" className="mt-1 size-4 accent-[var(--primary)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>
                  <span className="font-medium">Staff may contact me about this report</span>
                  <span className="block text-sm text-ink-3">Optional. Contact details are never shown publicly.</span>
                </span>
              </label>
              {consent && (
                <div className="space-y-2.5">
                  <input className="input" placeholder="Name (optional)" value={cName} onChange={(e) => setCName(e.target.value)} maxLength={80} />
                  <input
                    className="input"
                    type="email"
                    placeholder="Email"
                    value={cEmail}
                    onChange={(e) => setCEmail(e.target.value)}
                    maxLength={120}
                  />
                  <input className="input" type="tel" placeholder="Phone" value={cPhone} onChange={(e) => setCPhone(e.target.value)} maxLength={30} />
                </div>
              )}
              <div className="rounded-2xl border border-line bg-surface p-4 text-[13px] text-ink-2 leading-relaxed">
                When you send, we save your answers first, then attach the estimated wind and weather for that time. If weather
                can&apos;t be retrieved, your report is still saved and the weather is added later.
              </div>
              {error && <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-danger">{error}</p>}
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <button type="button" className="btn btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || submitting}>
          <ArrowLeft className="size-4" /> Back
        </button>
        {step < 3 ? (
          <button type="button" className="btn btn-primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Continue <ArrowRight className="size-4" />
          </button>
        ) : (
          <button type="button" className="btn btn-accent min-w-44" disabled={submitting} onClick={submit}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving &amp; attaching wind…
              </>
            ) : (
              <>
                Send report <Check className="size-4" />
              </>
            )}
          </button>
        )}
      </div>
    </main>
  );
}

function Row({ label, children, onEdit }: { label: string; children: React.ReactNode; onEdit: () => void }) {
  return (
    <div className="flex items-start gap-4 py-3">
      <dt className="w-32 shrink-0 text-[13px] text-ink-3">{label}</dt>
      <dd className="flex-1 text-sm">{children}</dd>
      <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 text-[13px] text-primary">
        <Pencil className="size-3.5" /> Edit
      </button>
    </div>
  );
}
