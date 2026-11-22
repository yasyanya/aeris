"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info, Layers, Lock, Pause, Play, X } from "lucide-react";
import type { PublicCell } from "@/lib/aggregate";
import { characterLabel, intensityInfo, INTENSITY, K_ANONYMITY, CATEGORY_MIN } from "@/lib/constants";
import { bearingDeg, compass, distanceM } from "@/lib/geo";
import { fmtDate, fmtTime, fmtWeekday, fromLocalInput } from "@/lib/format";
import { IntensityPill, WindArrow, windText } from "@/components/bits";

const PublicLeaflet = dynamic(() => import("@/components/map/PublicLeaflet"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-2" />,
});

type Agg = {
  cells: PublicCell[];
  hiddenCount: number;
  total: number;
  strip: { date: string; total: number; strong: number }[];
  facilities: { id: number; name: string; type: string; lat: number; lon: number; approx: boolean }[];
  from: string;
  to: string;
};
type Path = { facilityId: number; points: { lat: number; lon: number; minutes: number }[] };
type Range = { kind: "24h" | "7d" | "30d" } | { kind: "day"; date: string };

const DOWNTOWN = { lat: 33.2862, lon: -96.5722 };
export function areaName(c: PublicCell) {
  const p = { lat: c.center[0], lon: c.center[1] };
  const d = distanceM(DOWNTOWN, p);
  if (d < 600) return "Downtown Melissa area";
  return `~${(d / 1609.34).toFixed(1)} mi ${compass(bearingDeg(DOWNTOWN, p))} of downtown`;
}

function rangeToDates(r: Range): { from: Date; to: Date } {
  const now = new Date();
  if (r.kind === "day") {
    const from = fromLocalInput(`${r.date}T00:00`);
    return { from, to: new Date(from.getTime() + 86_400_000 - 1) };
  }
  const days = r.kind === "24h" ? 1 : r.kind === "7d" ? 7 : 30;
  return { from: new Date(now.getTime() - days * 86_400_000), to: now };
}

export default function PublicMapView({
  initial,
  wind,
  paths,
}: {
  initial: Agg;
  wind: { speedMph: number | null; fromDeg: number | null; t: string } | null;
  paths: Path[];
}) {
  const [data, setData] = useState<Agg>(initial);
  const [range, setRange] = useState<Range>({ kind: "7d" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPaths, setShowPaths] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const ctrlRef = useRef<AbortController | null>(null);
  const rangeRef = useRef<Range>({ kind: "7d" });

  /** Change the date range and load the aggregated cells for it. Called from event handlers only. */
  const changeRange = useCallback((r: Range) => {
    setRange(r);
    rangeRef.current = r;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    const { from, to } = rangeToDates(r);
    setLoading(true);
    fetch(`/api/map/aggregate?from=${from.toISOString()}&to=${to.toISOString()}`, { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((d: Agg) => {
        setData(d);
        setError(null);
        setSelectedId((id) => (d.cells.some((c) => c.id === id) ? id : null));
      })
      .catch((e) => e.name !== "AbortError" && setError("Couldn't load reports. Try another range or reload the page."))
      .finally(() => ctrlRef.current === ctrl && setLoading(false));
  }, []);

  // Playback through the last 30 days, Smell Pittsburgh-style (one day per tick).
  useEffect(() => {
    if (!playing) return;
    const days = data.strip.map((d) => d.date);
    const cur = rangeRef.current;
    let i = cur.kind === "day" ? Math.max(0, days.indexOf(cur.date)) : 0;
    const timer = setInterval(() => {
      i++;
      if (i >= days.length) {
        setPlaying(false);
        return;
      }
      changeRange({ kind: "day", date: days[i] });
    }, 1100);
    return () => clearInterval(timer);
  }, [playing, data.strip, changeRange]);

  const startStopPlayback = () => {
    if (playing) return setPlaying(false);
    if (rangeRef.current.kind !== "day" && data.strip[0]) changeRange({ kind: "day", date: data.strip[0].date });
    setPlaying(true);
  };

  const selected = data.cells.find((c) => c.id === selectedId) ?? null;
  const maxStrong = useMemo(() => Math.max(1, ...data.strip.map((d) => d.strong)), [data.strip]);
  const onSelect = useCallback((id: string | null) => setSelectedId(id), []);
  const rangeLabel =
    range.kind === "day" ? fmtWeekday(fromLocalInput(`${range.date}T12:00`)) : { "24h": "Last 24 hours", "7d": "Last 7 days", "30d": "Last 30 days" }[range.kind];

  const rangeTabs = (compact = false) => (
    <div className={`flex gap-1 rounded-full bg-surface-2 p-1 ${compact ? "" : "w-full"}`} role="tablist" aria-label="Date range">
      {(["24h", "7d", "30d"] as const).map((k) => (
        <button
          key={k}
          role="tab"
          aria-selected={range.kind === k}
          onClick={() => {
            setPlaying(false);
            changeRange({ kind: k });
          }}
          className={`flex-1 rounded-full px-3 h-9 text-[13px] font-medium transition whitespace-nowrap ${range.kind === k ? "bg-ink text-surface" : "text-ink-2 hover:text-ink"}`}
        >
          {k === "24h" ? "24 h" : k === "7d" ? "7 days" : "30 days"}
        </button>
      ))}
    </div>
  );

  const cellDetail = (c: PublicCell) => (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Selected area</p>
          <h3 className="mt-1 text-lg font-semibold">{areaName(c)}</h3>
        </div>
        <button onClick={() => setSelectedId(null)} className="icon-btn size-9 shadow-none" aria-label="Close area details">
          <X className="size-4" />
        </button>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <dt className="label">Reports</dt>
          <dd className="text-2xl font-semibold">{c.count}</dd>
        </div>
        <div>
          <dt className="label">Median intensity</dt>
          <dd className="mt-1.5">
            <IntensityPill value={c.medianIntensity} />
          </dd>
        </div>
      </dl>
      <div className="mt-4">
        <p className="label">Most reported odor types</p>
        {c.categories.length ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {c.categories.map((k) => (
              <li key={k.key} className="rounded-full border border-line px-3 h-7 inline-flex items-center text-[12px]">
                {characterLabel(k.key)} <span className="ml-1.5 text-ink-3">{k.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-ink-3">No single type was reported often enough to show.</p>
        )}
      </div>
      <p className="mt-4 flex gap-2 text-[12px] text-ink-3">
        <Lock className="mt-0.5 size-3.5 shrink-0" />
        Area about 500 m across. Individual reports and exact locations are never shown; odor types appear only when at least{" "}
        {CATEGORY_MIN} reports share them.
      </p>
    </div>
  );

  return (
    <div className="public-map relative h-[calc(100dvh-68px)] md:h-[calc(100dvh-64px)] overflow-hidden">
      <div className="absolute inset-0">
        <PublicLeaflet cells={data.cells} facilities={data.facilities} selectedId={selectedId} onSelect={onSelect} paths={paths} showPaths={showPaths} />
      </div>

      {/* ---------- desktop side panel ---------- */}
      <aside className="card absolute left-4 top-4 bottom-[104px] z-[500] hidden w-[380px] flex-col overflow-hidden md:flex">
        <div className="border-b border-line p-5">
          <h1 className="text-xl font-semibold tracking-tight">Community map</h1>
          <p className="mt-1 text-[13px] text-ink-3">Odor reports grouped into areas, plus nearby facilities and wind.</p>
          <div className="mt-4">
            {rangeTabs()}
          </div>
          {range.kind === "day" && (
            <p className="mt-2 text-[13px] text-ink-2">
              Showing <strong>{rangeLabel}</strong>{" "}
              <button className="text-primary" onClick={() => (setPlaying(false), changeRange({ kind: "7d" }))}>
                · reset
              </button>
            </p>
          )}
          <dl className="mt-4 grid grid-cols-3 gap-3">
            <div>
              <dt className="label">Reports</dt>
              <dd className="text-xl font-semibold">{data.total}</dd>
            </div>
            <div>
              <dt className="label">Areas shown</dt>
              <dd className="text-xl font-semibold">{data.cells.length}</dd>
            </div>
            <div>
              <dt className="label">Not shown*</dt>
              <dd className="text-xl font-semibold">{data.hiddenCount}</dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] text-ink-3">
            *Reports in areas with fewer than {K_ANONYMITY} reports are counted but not mapped, to protect privacy.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {error && <p className="mb-3 rounded-xl bg-surface-2 p-3 text-sm text-danger">{error}</p>}
          {selected ? (
            cellDetail(selected)
          ) : data.cells.length ? (
            <>
              <p className="eyebrow mb-3">Areas · tap to explore</p>
              <ul className="space-y-2">
                {data.cells.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelectedId(c.id)}
                      className="w-full rounded-2xl bg-surface-2 px-4 py-3 text-left transition hover:ring-1 hover:ring-ink-3"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium">{areaName(c)}</span>
                        <span className="badge bg-surface text-ink border border-line">{c.count} reports</span>
                      </span>
                      <span className="mt-1.5 flex items-center gap-2 text-[12px] text-ink-3">
                        <span className="size-2.5 rounded-full" style={{ background: intensityInfo(c.medianIntensity).color }} />
                        Median {c.medianIntensity} · {intensityInfo(c.medianIntensity).short}
                        {c.categories[0] && <> · mostly {characterLabel(c.categories[0].key).toLowerCase()}</>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-ink-3">{loading ? "Loading…" : "No areas meet the privacy threshold in this period."}</p>
          )}
        </div>
        <Legend />
      </aside>

      {/* ---------- mobile top controls ---------- */}
      <div className="absolute inset-x-3 top-3 z-[500] md:hidden">
        <div className="card p-1.5">
          {rangeTabs()}
          <p className="px-2 pb-1 pt-2 text-[12px] text-ink-3">
            <strong className="text-ink">{data.total}</strong> reports · <strong className="text-ink">{data.cells.length}</strong> areas shown ·
            tap an area for details
          </p>
        </div>
      </div>

      {/* ---------- wind + layers (top-right) ---------- */}
      <div className="absolute right-3 top-[124px] md:top-4 md:right-4 z-[500] flex flex-col items-end gap-2">
        <div className="card flex items-center gap-3 px-4 py-2.5">
          {wind?.fromDeg != null ? <WindArrow fromDeg={wind.fromDeg} className="size-7" /> : <Info className="size-5 text-ink-3" />}
          <div className="leading-tight">
            <p className="text-sm font-semibold">{wind ? windText(wind.speedMph, wind.fromDeg) : "Wind unavailable"}</p>
            <p className="text-[11px] text-ink-3">{wind ? `Regional estimate · ${fmtTime(wind.t)}` : "Weather service not responding"}</p>
          </div>
        </div>
        {paths.length > 0 && (
          <button
            onClick={() => setShowPaths((v) => !v)}
            className={`card flex items-center gap-2 px-3.5 h-10 text-[13px] ${showPaths ? "" : "opacity-70"}`}
            aria-pressed={showPaths}
          >
            <Layers className="size-4" />
            {showPaths ? "Hide" : "Show"} air-movement estimate
          </button>
        )}
      </div>

      {/* ---------- mobile selected-area sheet ---------- */}
      {selected && (
        <div className="card absolute inset-x-3 bottom-[92px] z-[600] max-h-[55%] overflow-y-auto p-5 md:hidden">
          {cellDetail(selected)}
        </div>
      )}

      {/* ---------- day strip timeline ---------- */}
      <div className="card absolute inset-x-3 bottom-3 z-[500] flex items-center gap-3 p-2.5 md:left-[412px] md:right-4 md:bottom-4">
        <button
          onClick={startStopPlayback}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-surface"
          aria-label={playing ? "Pause playback" : "Play the last 30 days"}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
        </button>
        <div className="flex-1 overflow-x-auto">
          <ol className="flex min-w-max gap-1">
            {data.strip.map((d) => {
              const sel = range.kind === "day" && range.date === d.date;
              const shade = d.strong / maxStrong;
              const dt = fromLocalInput(`${d.date}T12:00`);
              return (
                <li key={d.date}>
                  <button
                    onClick={() => (setPlaying(false), changeRange({ kind: "day", date: d.date }))}
                    title={`${fmtWeekday(dt)}: ${d.total} reports, ${d.strong} rated 3+`}
                    className={`flex w-9 flex-col items-center gap-1 rounded-lg py-1 ${sel ? "ring-2 ring-primary" : ""}`}
                  >
                    <span
                      className="block h-7 w-7 rounded-md border border-line"
                      style={{ background: d.strong ? `color-mix(in srgb, var(--ink) ${Math.round(15 + shade * 85)}%, transparent)` : "var(--surface-2)" }}
                    />
                    <span className="text-[10px] text-ink-3 whitespace-nowrap">{fmtDate(dt).replace(/^\w+ /, "")}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <p className="hidden lg:block w-28 shrink-0 text-[11px] leading-tight text-ink-3">Darker days had more reports rated 3+</p>
      </div>
      {loading && <div className="absolute left-1/2 top-4 z-[700] -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-[12px] text-surface">Loading…</div>}
    </div>
  );
}

function Legend() {
  return (
    <div className="border-t border-line bg-surface-2/60 p-4 text-[12px]">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Legend</p>
        <Link href="/learn#map" className="text-primary">
          How to read this map
        </Link>
      </div>
      <div className="mt-2 flex items-center gap-1">
        {INTENSITY.map((i) => (
          <span key={i.value} className="flex-1 text-center">
            <span className="block h-2 rounded-full" style={{ background: i.color }} />
            <span className="text-[10px] text-ink-3">{i.value}</span>
          </span>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-ink-3">Area colour = median reported intensity (0 none → 5 very strong)</p>
      <div className="mt-2.5 grid grid-cols-2 gap-2 text-ink-2">
        <span className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-md border-[1.5px] border-ink bg-white text-[10px] font-semibold text-[#111418]">L</span>
          Facility
        </span>
        <span className="flex items-center gap-2">
          <svg width="26" height="6">
            <line x1="1" y1="3" x2="25" y2="3" stroke="#7c5cff" strokeWidth="3" strokeDasharray="2 6" strokeLinecap="round" />
          </svg>
          Air movement (est.)
        </span>
      </div>
    </div>
  );
}
