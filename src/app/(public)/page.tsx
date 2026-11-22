import Link from "next/link";
import { ArrowRight, ArrowUpRight, Clock, MapPin, MessageSquareText, ShieldCheck, Wind } from "lucide-react";
import { currentConditions } from "@/lib/conditions";
import { publicStats, publishedUpdates } from "@/lib/data";
import { fmtAgo, fmtTime } from "@/lib/format";
import { RESOURCES } from "@/lib/constants";
import { Attribution, WindArrow, windText } from "@/components/bits";

export const dynamic = "force-dynamic";

const HINT_STYLE = {
  elevated: { label: "Odors more likely to linger", cls: "bg-[#fde8dc] text-[#9a3a0b] dark:bg-[#3a1d0e] dark:text-[#ffb48a]" },
  moderate: { label: "Some odor-favourable conditions", cls: "bg-[#fff4cc] text-[#7a5b00] dark:bg-[#332a0a] dark:text-[#ffd966]" },
  low: { label: "Conditions favour dispersion", cls: "bg-primary-soft text-primary" },
  unknown: { label: "Conditions unknown", cls: "bg-surface-2 text-ink-3" },
} as const;

export default async function Home() {
  const [cond, stats, updates] = await Promise.all([currentConditions(), publicStats(), publishedUpdates(3)]);
  const hint = HINT_STYLE[cond.hint.level];
  return (
    <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 sm:py-10">
      <section className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="card relative overflow-hidden p-6 sm:p-10">
          <div
            className="pointer-events-none absolute -right-24 -top-24 size-[420px] rounded-full opacity-60 blur-3xl"
            style={{ background: "radial-gradient(circle, var(--primary-soft), transparent 70%)" }}
          />
          <p className="eyebrow">Melissa, Texas · Community prototype</p>
          <h1 className="mt-4 max-w-xl text-[34px] sm:text-[46px] font-semibold leading-[1.05] tracking-tight">
            Smell something? <span className="text-ink-3">Tell us in under a minute.</span>
          </h1>
          <p className="mt-4 max-w-lg text-ink-2 leading-relaxed">
            Your report is matched with wind and weather for that moment, shown on a privacy-safe community map, and reviewed by
            staff. You can follow every step and read the response.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/report" className="btn btn-primary">
              Report an odor <ArrowRight className="size-4" />
            </Link>
            <Link href="/map" className="btn btn-ghost">
              Explore the map
            </Link>
          </div>
          <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-line pt-6 max-w-lg">
            <div>
              <dt className="label">Reports this week</dt>
              <dd className="text-2xl font-semibold mt-1">{stats.week}</dd>
            </div>
            <div>
              <dt className="label">Reports answered</dt>
              <dd className="text-2xl font-semibold mt-1">{stats.responded}</dd>
            </div>
            <div>
              <dt className="label">Total reports</dt>
              <dd className="text-2xl font-semibold mt-1">{stats.total}</dd>
            </div>
          </dl>
        </div>

        <div className="card flex flex-col p-6">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Wind right now</p>
            <span className="badge bg-surface-2 text-ink-3 border border-line">Estimate</span>
          </div>
          {cond.ok && cond.now ? (
            <>
              <div className="mt-5 flex items-center gap-5">
                <div className="relative flex size-24 items-center justify-center rounded-full border border-line bg-surface-2">
                  <span className="absolute top-1.5 text-[10px] text-ink-3">N</span>
                  {cond.now.windFromDeg != null && <WindArrow fromDeg={cond.now.windFromDeg} className="size-12" />}
                </div>
                <div>
                  <p className="text-2xl font-semibold tracking-tight">{windText(cond.now.windSpeedMph, cond.now.windFromDeg)}</p>
                  <p className="mt-1 text-sm text-ink-3">
                    {cond.now.tempF != null && `${Math.round(cond.now.tempF)}°F · `}
                    {cond.now.gustMph != null && `gusts ${Math.round(cond.now.gustMph)} mph · `}
                    as of {fmtTime(cond.now.t)}
                  </p>
                </div>
              </div>
              <div className={`mt-5 rounded-2xl px-4 py-3 text-sm ${hint.cls}`}>
                <p className="font-medium">{hint.label}</p>
                <p className="mt-0.5 opacity-80">{cond.hint.reasons.join(" · ")}</p>
              </div>
              <div className="mt-5 grid grid-cols-6 gap-1.5 text-center">
                {cond.next.map((h) => (
                  <div key={h.t} className="rounded-xl bg-surface-2 py-2">
                    <p className="text-[10px] text-ink-3">{fmtTime(h.t).replace(":00", "")}</p>
                    {h.windFromDeg != null && <WindArrow fromDeg={h.windFromDeg} className="mx-auto my-1 size-4" />}
                    <p className="text-[11px] font-medium">{h.windSpeedMph != null ? Math.round(h.windSpeedMph) : "–"}</p>
                  </div>
                ))}
              </div>
              <p className="mt-auto pt-5 text-[12px] text-ink-3 leading-relaxed">
                Arrows point where the air is going. Values are model estimates for the Melissa area (about a 3 km grid), not
                on-site readings.
              </p>
            </>
          ) : (
            <div className="mt-6 rounded-2xl bg-surface-2 p-5 text-sm text-ink-2">
              <Wind className="mb-2 size-5 text-ink-3" />
              Live weather is unavailable right now. Reports are still saved, and the wind is added automatically once the
              service responds.
            </div>
          )}
        </div>
      </section>

      <section className="mt-5 grid gap-5 md:grid-cols-3">
        {[
          { icon: MapPin, title: "1 · Pin it", text: "Use your location or drop a pin. Your exact spot is visible only to investigators." },
          { icon: Clock, title: "2 · Describe it", text: "When, how strong, what it smelled like, and for how long. The source is optional." },
          { icon: MessageSquareText, title: "3 · Follow it", text: "Get a receipt code. Track review, investigation and the published response." },
        ].map((s) => (
          <div key={s.title} className="card p-6">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
              <s.icon className="size-5" />
            </span>
            <h3 className="mt-4 font-semibold">{s.title}</h3>
            <p className="mt-1 text-sm text-ink-2 leading-relaxed">{s.text}</p>
          </div>
        ))}
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent published responses</h2>
            <Link href="/learn#process" className="text-sm text-ink-3 hover:text-ink">
              How responses work
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-line">
            {updates.length === 0 && <li className="py-4 text-sm text-ink-3">No responses published yet.</li>}
            {updates.map((u, i) => (
              <li key={i} className="py-4">
                <p className="text-[12px] text-ink-3">
                  Report from {fmtAgo(u.observed_at)} · published {fmtAgo(u.published_at)}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-2 line-clamp-3">{u.body}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Learn more</h2>
          </div>
          <ul className="mt-4 space-y-2">
            {RESOURCES.slice(0, 4).map((r) => (
              <li key={r.href}>
                <a
                  href={r.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 hover:bg-surface-2"
                >
                  <span>
                    <span className="block text-[11px] font-semibold text-ink-3">{r.org}</span>
                    <span className="text-sm font-medium">{r.title}</span>
                  </span>
                  <ArrowUpRight className="size-4 text-ink-3 group-hover:text-ink" />
                </a>
              </li>
            ))}
          </ul>
          <Link href="/learn" className="mt-4 inline-flex text-sm text-primary font-medium">
            All explainers and resources →
          </Link>
        </div>
      </section>
      <Attribution className="mt-8 text-center" />
    </main>
  );
}
