import Link from "next/link";
import { ArrowUpRight, Compass, Eye, FileSearch, Lock, MessagesSquare, Wind } from "lucide-react";
import { INTENSITY, K_ANONYMITY, RESOURCES, TCEQ_COMPLAINT_URL } from "@/lib/constants";
import { WindArrow } from "@/components/bits";
import { ThemeToggle } from "@/components/theme";

export const metadata = { title: "Learn" };

const FAQ = [
  {
    q: "Is the odor harmful to my health?",
    a: "Odors can be unpleasant and cause headaches or nausea for some people even at low levels. Aeris doesn't measure chemicals and can't assess health risk. NTMWD's odor FAQ explains what's known about landfill odors. For a medical emergency, call 911.",
  },
  {
    q: "Why does the smell come and go?",
    a: "Weather matters as much as the source. Calm air, cool mornings and evenings (when inversions trap air near the ground), falling pressure and rain all make odors more noticeable. A steady breeze usually disperses them.",
  },
  {
    q: "Does a report here count as an official complaint?",
    a: "Reports go to NTMWD staff, who review and respond. They are not filed with the state. A formal nuisance case under TCEQ rules needs a complaint filed with TCEQ, and anonymous complaints can't establish a nuisance there. You can do both.",
  },
  {
    q: "Who can see my report?",
    a: `Investigators see your exact location and the details you entered. The public sees only areas of about half a kilometre with at least ${K_ANONYMITY} reports, the median intensity, and the odor types at least two reports share. Notes and contact details are never public.`,
  },
  {
    q: "Why is my area not on the map?",
    a: `To protect privacy, an area appears only once it has ${K_ANONYMITY} or more reports in the selected period. Your report still counts in the totals and goes to staff.`,
  },
  {
    q: "Why isn't there an AI chatbot?",
    a: "We kept answers short and reviewed by people. A chatbot could give confident but wrong answers about health or about who is responsible, so for now we link to official sources instead.",
  },
];

export default function LearnPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Learn</p>
        <ThemeToggle className="md:hidden" />
      </div>
      <h1 className="mt-2 max-w-2xl text-2xl sm:text-[28px] font-semibold tracking-tight">How Aeris works</h1>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <section id="map" className="card scroll-mt-24 p-6">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Eye className="size-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">Reading the community map</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-2 leading-relaxed">
            <li>
              <strong>Hexagons</strong> are areas about 500 m across. Their colour is the <em>median</em> intensity reported there.
            </li>
            <li>
              <strong>Squares with letters</strong> are nearby facilities (L landfill, C compost, W wastewater). Locations are approximate.
            </li>
            <li>
              <strong>The day strip</strong> at the bottom shades each day by how many reports were rated 3 or higher. Tap a day to see just that day.
            </li>
          </ul>
          <div className="mt-4 flex gap-1">
            {INTENSITY.map((i) => (
              <span key={i.value} className="flex-1 rounded-lg px-1 py-1.5 text-center text-[11px] text-ink-2 bg-surface-2">
                <span className="mx-auto mb-1 block size-3 rounded-full" style={{ background: i.color }} />
                {i.value} {i.short}
              </span>
            ))}
          </div>
        </section>

        <section id="wind" className="card scroll-mt-24 p-6">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Wind className="size-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">What the wind arrow means</h2>
          <div className="mt-3 flex items-center gap-4 rounded-2xl bg-surface-2 p-4">
            <WindArrow fromDeg={225} className="size-10" />
            <p className="text-sm text-ink-2">
              &ldquo;From SW&rdquo;: air is coming <em>from</em> the south-west and moving north-east, the way the arrow points.
            </p>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-ink-2 leading-relaxed">
            <li>
              Wind comes from the free <a className="text-primary" href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a>{" "}
              weather model on a grid of about 3 km. It is an <strong>estimate</strong>, not a reading from a station on site.
            </li>
            <li>The dashed purple lines show where air from each facility may travel over the next couple of hours. They are not odor measurements.</li>
            <li>Under 2 mph we call the wind &ldquo;calm&rdquo;. In calm air the direction isn&apos;t meaningful and odors can pool in any direction.</li>
          </ul>
        </section>

        <section id="screening" className="card scroll-mt-24 p-6">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Compass className="size-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">How staff screen possible sources</h2>
          <p className="mt-3 text-sm text-ink-2 leading-relaxed">
            For each report, investigators see which configured facilities were <strong>upwind</strong> of you at that time. The
            check uses a cone of about ±22° around the wind direction plus a simple backward path of the air over the previous
            three hours. This narrows down where to look; it doesn&apos;t assign blame. Calm or shifting wind, missing weather, or
            several facilities in the same direction give an <strong>inconclusive</strong> result. Patrols and facility checks
            then confirm what&apos;s going on.
          </p>
        </section>

        <section id="process" className="card scroll-mt-24 p-6">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
            <FileSearch className="size-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">What happens after you report</h2>
          <ol className="mt-3 space-y-3 text-sm text-ink-2">
            {[
              ["Received", "Your report is saved and weather is attached automatically."],
              ["Under review", "Staff look at your report, the wind, and other reports nearby."],
              ["Investigation", "Patrols check the area and facility operations, and record what they find."],
              ["Response published", "A manager reviews and publishes an answer you can read in My reports."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-surface">{i + 1}</span>
                <span>
                  <strong className="text-ink">{t}</strong>: {d}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section id="privacy" className="card scroll-mt-24 p-6 md:col-span-2">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Lock className="size-5" />
            </span>
            <h2 className="text-lg font-semibold">Your data and privacy</h2>
          </div>
          <div className="mt-3 grid gap-4 text-sm text-ink-2 leading-relaxed md:grid-cols-3">
            <p>
              <strong className="text-ink">Exact locations</strong> and contact details are visible only to authorised staff. The
              public map is built on the server, so raw points never reach the public.
            </p>
            <p>
              <strong className="text-ink">No account needed.</strong> Contact details are optional and used only if you agree.
              Address search is routed through our server so your device isn&apos;t exposed to third parties.
            </p>
            <p>
              <strong className="text-ink">Retention.</strong> In this prototype, data stays on the host machine. A production
              deployment should set a written retention period (e.g. 3 years for aggregated statistics, shorter for contact info).
            </p>
          </div>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Official resources</h2>
        <p className="mt-1 text-sm text-ink-3">Opens the source website in a new tab.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RESOURCES.map((r) => (
            <a key={r.href} href={r.href} target="_blank" rel="noreferrer" className="card group flex flex-col p-5 transition hover:-translate-y-0.5">
              <span className="flex items-center justify-between">
                <span className="badge bg-surface-2 text-ink-2 border border-line">{r.org}</span>
                <ArrowUpRight className="size-4 text-ink-3 group-hover:text-ink" />
              </span>
              <span className="mt-3 font-semibold">{r.title}</span>
              <span className="mt-1 text-sm text-ink-2 leading-relaxed">{r.blurb}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="card p-6">
          <div className="flex items-center gap-2">
            <MessagesSquare className="size-5 text-primary" />
            <h2 className="text-xl font-semibold">Frequently asked questions</h2>
          </div>
          <div className="mt-4 divide-y divide-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-1 font-medium">
                  {f.q}
                  <span className="text-ink-3 transition group-open:rotate-45 text-xl leading-none">+</span>
                </summary>
                <p className="mt-2 text-sm text-ink-2 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
        <div className="card flex flex-col p-6">
          <h2 className="font-semibold">Ready to report?</h2>
          <p className="mt-1 text-sm text-ink-2">It takes under a minute. You&apos;ll get a receipt code to follow up.</p>
          <Link href="/report" className="btn btn-primary mt-4">
            Report an odor
          </Link>
          <a href={TCEQ_COMPLAINT_URL} target="_blank" rel="noreferrer" className="btn btn-ghost mt-2">
            File a formal TCEQ complaint
          </a>
        </div>
      </section>
    </main>
  );
}
