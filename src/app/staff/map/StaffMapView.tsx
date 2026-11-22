"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Loader2, Map as MapIcon, MousePointerClick, Pause, Play, Satellite, X } from "lucide-react";
import type { StaffReportRow } from "@/lib/data";
import { corroborate, type ScreeningResult } from "@/lib/screening";
import { characterLabel, INTENSITY, intensityInfo } from "@/lib/constants";
import { fmtDateTime, fmtTime, fmtWeekday } from "@/lib/format";
import type { Fac, Overlay, WindPt } from "@/components/map/StaffLeaflet";
import { StaffStatusBadge } from "@/components/bits";

const StaffLeaflet = dynamic(() => import("@/components/map/StaffLeaflet"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-s-panel-2" />,
});

type Sel = { id: number; receiptCode: string; lat: number; lon: number; observedAt: string; intensity: number; screening: ScreeningResult | null };

const RANGES = { "24h": 1, "7d": 7, "30d": 30 } as const;
const WINDOW_H = 6;

export default function StaffMapView({
  rows,
  facilities,
  alerts,
  initialSelected,
}: {
  rows: StaffReportRow[];
  facilities: Fac[];
  alerts: { lat: number; lon: number; ids: number[]; end: string }[];
  initialSelected: number[];
}) {
  const [range, setRange] = useState<keyof typeof RANGES>("7d");
  const [minI, setMinI] = useState(0);
  const [base, setBase] = useState<"satellite" | "dark">("satellite");
  const [showWind, setShowWind] = useState(true);
  const [showCones, setShowCones] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>(initialSelected);
  const [loaded, setLoaded] = useState<{ key: string; results: Sel[] }>({ key: "", results: [] });
  const [wind, setWind] = useState<WindPt[]>([]);
  const [windAt, setWindAt] = useState<Date>(new Date());

  const [now] = useState(() => Date.now());
  const start = now - RANGES[range] * 86_400_000;
  // scrubber position: 1 = live (show everything in range)
  const [pos, setPos] = useState(1);
  const [playing, setPlaying] = useState(false);
  const live = pos >= 0.999;
  const t = start + (now - start) * pos;

  const visible = useMemo(
    () =>
      rows.filter((r) => {
        const ms = Date.parse(r.observedAt);
        if (r.intensity < minI) return false;
        if (selectedIds.includes(r.id)) return true;
        if (live) return ms >= start;
        return ms <= t && ms >= t - WINDOW_H * 3_600_000;
      }),
    [rows, minI, live, start, t, selectedIds],
  );

  // Fetch screening details for selected reports; derived state avoids synchronous setState in the effect.
  const selKey = selectedIds.join(",");
  useEffect(() => {
    if (!selKey) return;
    const ctrl = new AbortController();
    fetch(`/api/staff/screening?ids=${selKey}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => setLoaded({ key: selKey, results: d.results ?? [] }))
      .catch(() => {});
    return () => ctrl.abort();
  }, [selKey]);
  const selData = selKey && loaded.key === selKey ? loaded.results : [];
  const loadingSel = !!selKey && loaded.key !== selKey;

  // Wind field at the scrubber time, or at the selected report's time.
  // Rounded to the hour so scrubbing doesn't trigger a request per pixel.
  const singleObs = selData.length === 1 ? selData[0].observedAt : null;
  const windMs = singleObs ? Date.parse(singleObs) : live ? now : Math.round(t / 3_600_000) * 3_600_000;
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!showWind) return;
    const windTime = new Date(windMs);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      fetch(`/api/staff/windfield?t=${windTime.toISOString()}`)
        .then((r) => r.json())
        .then((d) => {
          setWind(d.points ?? []);
          setWindAt(windTime);
        })
        .catch(() => setWind([]));
    }, 450);
  }, [windMs, showWind]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setPos((p) => {
        const step = (1 / (RANGES[range] * 24)) * 1; // one hour per tick
        if (p + step >= 1) {
          setPlaying(false);
          return 1;
        }
        return p + step;
      });
    }, 260);
    return () => clearInterval(id);
  }, [playing, range]);

  const onSelect = (id: number, additive: boolean) =>
    setSelectedIds((s) => (additive ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : s.length === 1 && s[0] === id ? [] : [id]));

  const overlays: Overlay[] = selData.map((s) => ({
    reportId: s.id,
    lat: s.lat,
    lon: s.lon,
    fromDeg: s.screening?.wind?.fromDeg ?? null,
    toleranceDeg: s.screening?.toleranceDeg ?? null,
    trajectory: s.screening?.trajectory ?? [],
  }));
  const corr = selData.length > 1 ? corroborate(selData.map((s) => s.screening!).filter(Boolean)) : null;
  const highlight =
    selData.length === 1
      ? (selData[0].screening?.candidates.filter((c) => c.level !== "nearby").map((c) => c.facilityId) ?? [])
      : (corr?.facilities.filter((f) => f.votes >= Math.max(2, Math.ceil(corr.usable / 2))).map((f) => f.facilityId) ?? []);

  const toggle = (on: boolean, set: (v: boolean) => void, label: string) => (
    <label className="flex cursor-pointer items-center justify-between py-1.5 text-sm">
      {label}
      <span className={`relative h-5 w-9 rounded-full transition ${on ? "bg-s-cyan" : "bg-s-line"}`}>
        <input type="checkbox" className="sr-only" checked={on} onChange={(e) => set(e.target.checked)} />
        <span className={`absolute top-0.5 size-4 rounded-full bg-white transition ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </label>
  );

  return (
    <div className="flex h-screen">
      {/* ---------- control panel ---------- */}
      <aside className="flex w-[340px] shrink-0 flex-col border-r border-s-line bg-s-panel">
        <div className="border-b border-s-line p-5">
          <p className="s-label">Analysis map</p>
          <h1 className="mt-1 text-lg font-semibold">Reports, wind &amp; trajectories</h1>
          <div className="mt-4 flex gap-1 rounded-full bg-s-panel-2 p-1">
            {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((k) => (
              <button
                key={k}
                onClick={() => (setRange(k), setPos(1), setPlaying(false))}
                className={`flex-1 rounded-full h-8 text-[12px] ${range === k ? "bg-s-ink text-s-bg" : "text-s-ink-2"}`}
              >
                {k === "24h" ? "24 h" : k === "7d" ? "7 days" : "30 days"}
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center justify-between text-sm">
            Min. intensity
            <select className="s-input h-8 w-24" value={minI} onChange={(e) => setMinI(Number(e.target.value))}>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? "Any" : `${n}+`}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-2 border-t border-s-line pt-2">
            {toggle(showWind, setShowWind, "Wind field (model, 5×5 grid)")}
            {toggle(showCones, setShowCones, "Upwind cones for selected")}
          </div>
          <div className="mt-2 flex gap-1 rounded-full bg-s-panel-2 p-1">
            {(["satellite", "dark"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBase(b)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full h-8 text-[12px] ${base === b ? "bg-s-ink text-s-bg" : "text-s-ink-2"}`}
              >
                {b === "satellite" ? <Satellite className="size-3.5" /> : <MapIcon className="size-3.5" />}
                {b === "satellite" ? "Satellite" : "Dark"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!selectedIds.length ? (
            <div className="text-sm text-s-ink-2">
              <MousePointerClick className="mb-2 size-5 text-s-ink-3" />
              Click a report to see its back-trajectory and upwind cone. <strong className="text-s-ink">Shift-click</strong> several reports
              to compare which facilities they have in common.
              <p className="mt-4 s-label">Intensity</p>
              <div className="mt-2 flex gap-1">
                {INTENSITY.map((i) => (
                  <span key={i.value} className="flex-1 text-center text-[11px] text-s-ink-3">
                    <span className="mb-1 block h-2 rounded-full" style={{ background: i.color }} />
                    {i.value}
                  </span>
                ))}
              </div>
              {alerts.length > 0 && (
                <>
                  <p className="mt-6 s-label">Detected events (≥3 reports, 1 h, 2 km)</p>
                  <ul className="mt-2 space-y-1.5">
                    {alerts.slice(0, 6).map((a, i) => (
                      <li key={i}>
                        <button onClick={() => setSelectedIds(a.ids)} className="w-full rounded-lg bg-s-panel-2 px-3 py-2 text-left text-[13px] hover:ring-1 hover:ring-s-accent">
                          <span className="text-s-accent">●</span> {fmtDateTime(a.end)} · {a.ids.length} reports
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <p className="s-label">{selectedIds.length} selected</p>
                <button onClick={() => setSelectedIds([])} className="flex items-center gap-1 text-[12px] text-s-ink-3 hover:text-s-ink">
                  <X className="size-3.5" /> Clear
                </button>
              </div>
              {loadingSel && <Loader2 className="mt-3 size-4 animate-spin text-s-ink-3" />}
              {corr && (
                <div className="mt-3 rounded-xl border border-s-accent/30 bg-s-accent/10 p-3.5">
                  <p className="text-sm font-medium">Corroboration across {corr.total} reports</p>
                  <p className="text-[12px] text-s-ink-3">{corr.usable} had usable wind (not calm or missing)</p>
                  <ul className="mt-2 space-y-1.5 text-[13px]">
                    {corr.facilities.length === 0 && <li className="text-s-ink-2">No configured facility is upwind of any of them.</li>}
                    {corr.facilities.map((f) => (
                      <li key={f.facilityId}>
                        <div className="flex justify-between">
                          <span>{f.name.split(" (")[0]}</span>
                          <span className="tabular-nums text-s-ink-2">
                            {f.votes}/{corr.usable}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-s-line">
                          <div className="h-full rounded-full bg-s-accent" style={{ width: `${(f.votes / Math.max(1, corr.usable)) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-s-ink-3">Counts reports whose upwind screen lists the facility. Agreement narrows the search; it is not proof.</p>
                </div>
              )}
              <ul className="mt-3 space-y-2.5">
                {selData.map((s) => {
                  const row = rows.find((r) => r.id === s.id);
                  return (
                    <li key={s.id} className="rounded-xl bg-s-panel-2 p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full" style={{ background: intensityInfo(s.intensity).color }} />
                        <span className="font-mono text-[13px]">{s.receiptCode}</span>
                        <Link href={`/staff/reports/${s.id}`} className="ml-auto text-s-cyan" aria-label="Open report">
                          <ArrowUpRight className="size-4" />
                        </Link>
                      </div>
                      <p className="mt-1 text-[12px] text-s-ink-3">
                        {fmtDateTime(s.observedAt)} · {row?.characters.map(characterLabel).join(", ")}
                      </p>
                      {row && (
                        <div className="mt-1.5">
                          <StaffStatusBadge status={row.status} />
                        </div>
                      )}
                      <p className="mt-2 text-[13px] font-medium">{s.screening?.headline ?? "Not screened"}</p>
                      {s.screening?.candidates.slice(0, 3).map((c) => (
                        <p key={c.facilityId} className="text-[12px] text-s-ink-2">
                          · {c.name.split(" (")[0]} — {c.level === "stronger" ? "stronger fit" : c.level}
                        </p>
                      ))}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </aside>

      {/* ---------- map ---------- */}
      <div className="staff-map relative flex-1">
        <StaffLeaflet
          base={base}
          points={visible.map((r) => ({ id: r.id, lat: r.lat, lon: r.lon, intensity: r.intensity, label: `${r.receiptCode} · ${fmtDateTime(r.observedAt)}` }))}
          facilities={facilities}
          selectedIds={selectedIds}
          overlays={overlays}
          windField={showWind ? wind : []}
          alerts={live ? alerts.filter((a) => Date.parse(a.end) >= start) : []}
          highlightFacilities={highlight}
          onSelect={onSelect}
          showCones={showCones}
        />
        {showWind && (
          <div className="absolute right-14 top-3 z-[500] rounded-full bg-s-bg/85 px-3 py-1.5 text-[12px] text-s-ink-2 backdrop-blur">
            Wind field at {fmtWeekday(windAt)} {fmtTime(windAt)} · model estimate
          </div>
        )}
        {/* ---------- playback scrubber ---------- */}
        <div className="absolute inset-x-4 bottom-4 z-[500] flex items-center gap-4 rounded-2xl bg-s-bg/90 px-4 py-3 backdrop-blur">
          <button
            onClick={() => {
              if (live) setPos(0);
              setPlaying((p) => !p);
            }}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-s-panel-2 text-s-ink"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
          </button>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(pos * 1000)}
            onChange={(e) => (setPlaying(false), setPos(Number(e.target.value) / 1000))}
            className="flex-1 accent-[var(--s-cyan)]"
            aria-label="Time"
          />
          <div className="w-48 shrink-0 text-right text-[12px] leading-tight">
            {live ? (
              <>
                <p className="font-medium text-s-cyan">All reports in range</p>
                <p className="text-s-ink-3">{visible.length} shown</p>
              </>
            ) : (
              <>
                <p className="font-medium">
                  {fmtWeekday(new Date(t))} {fmtTime(new Date(t))}
                </p>
                <p className="text-s-ink-3">
                  previous {WINDOW_H} h · {visible.length} shown
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
