// Small presentational pieces shared across public and staff UIs.
import { intensityInfo, statusLabel } from "@/lib/constants";
import { compass } from "@/lib/geo";

export function IntensityDot({ value, className = "size-3" }: { value: number; className?: string }) {
  return <span className={`inline-block shrink-0 rounded-full ${className}`} style={{ background: intensityInfo(value).color }} aria-hidden />;
}

export function IntensityPill({ value }: { value: number }) {
  const info = intensityInfo(value);
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 text-[12px] font-medium text-ink">
      <IntensityDot value={value} className="size-2.5" />
      {Number.isInteger(value) ? value : value.toFixed(1)} · {info.short}
    </span>
  );
}

/** Arrow pointing the way the wind is GOING (from + 180°), like a weather-map vector. */
export function WindArrow({ fromDeg, className = "size-6", color = "var(--wind)" }: { fromDeg: number; className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={{ transform: `rotate(${(fromDeg + 180) % 360}deg)` }} aria-hidden>
      <path d="M12 3 L18 15 L12 12 L6 15 Z" fill={color} />
      <path d="M12 12 V21" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function windText(speedMph: number | null | undefined, fromDeg: number | null | undefined) {
  if (speedMph == null || fromDeg == null) return "Wind unavailable";
  if (speedMph < 2) return `Calm (${speedMph.toFixed(1)} mph)`;
  return `From ${compass(fromDeg)} · ${Math.round(speedMph)} mph`;
}

const STATUS_STYLE: Record<string, string> = {
  received: "bg-surface-2 text-ink-2 border border-line",
  under_review: "bg-violet-soft text-violet",
  investigating: "bg-primary-soft text-primary",
  responded: "bg-ink text-surface",
  closed: "bg-surface-2 text-ink-3 border border-line",
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_STYLE[status] ?? STATUS_STYLE.received}`}>{statusLabel(status)}</span>;
}

export function Attribution({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[11px] text-ink-3 ${className}`}>
      Weather:{" "}
      <a className="underline" href="https://open-meteo.com/" target="_blank" rel="noreferrer">
        Open-Meteo
      </a>{" "}
      (CC BY 4.0) model estimates; backup: National Weather Service observations at McKinney airport. Map data © OpenStreetMap contributors.
    </p>
  );
}
