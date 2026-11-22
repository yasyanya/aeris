// Small presentational pieces shared across public and staff UIs.
import { intensityInfo, statusLabel } from "@/lib/constants";
import { compass } from "@/lib/geo";

export function IntensityDot({ value, className = "size-3" }: { value: number; className?: string }) {
  return <span className={`inline-block shrink-0 rounded-full ${className}`} style={{ background: intensityInfo(value).color }} aria-hidden />;
}

export function IntensityPill({ value, dark = false }: { value: number; dark?: boolean }) {
  const info = intensityInfo(value);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 h-6 text-[12px] font-medium ${dark ? "bg-s-panel-2 text-s-ink" : "bg-surface-2 text-ink"}`}
    >
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
  under_review: "bg-[#efe9ff] text-[#5b3fd6] dark:bg-[#2a2350] dark:text-[#c7b8ff]",
  investigating: "bg-lime text-[#1d2a00]",
  responded: "bg-ink text-lime",
  closed: "bg-surface-2 text-ink-3 border border-line",
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_STYLE[status] ?? STATUS_STYLE.received}`}>{statusLabel(status)}</span>;
}

const S_STATUS_STYLE: Record<string, string> = {
  received: "bg-s-accent/15 text-s-accent",
  under_review: "bg-violet/20 text-[#c7b8ff]",
  investigating: "bg-lime/15 text-lime",
  responded: "bg-s-cyan/15 text-s-cyan",
  closed: "bg-s-panel-2 text-s-ink-3",
};
export function StaffStatusBadge({ status }: { status: string }) {
  return <span className={`badge ${S_STATUS_STYLE[status] ?? S_STATUS_STYLE.received}`}>{statusLabel(status)}</span>;
}

export function Attribution({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[11px] text-ink-3 ${className}`}>
      Weather:{" "}
      <a className="underline" href="https://open-meteo.com/" target="_blank" rel="noreferrer">
        Open-Meteo
      </a>{" "}
      (CC BY 4.0), modelled estimates. Map data © OpenStreetMap contributors.
    </p>
  );
}
