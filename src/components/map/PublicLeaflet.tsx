"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap, ZoomControl } from "react-leaflet";
import { MAP_CENTER, MAP_ZOOM, intensityInfo } from "@/lib/constants";
import type { PublicCell } from "@/lib/aggregate";
import { TILES } from "./tiles";
import { facilityIcon } from "./PinPickerMap";

type Fac = { id: number; name: string; type: string; lat: number; lon: number; approx: boolean };
type Path = { facilityId: number; points: { lat: number; lon: number; minutes: number }[] };

const RAMP = ["#b8bec6", "#63c174", "#f2cc3d", "#f39237", "#e0483e", "#8f2d6b"];
export const rampColor = (v: number) => RAMP[Math.max(0, Math.min(5, Math.round(v)))];

function usePrefersDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const set = () => setDark(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);
  return dark;
}

function FitTo({ cell }: { cell: PublicCell | null }) {
  const map = useMap();
  useEffect(() => {
    if (cell) map.panTo(cell.center, { animate: true });
  }, [cell, map]);
  return null;
}

export default function PublicLeaflet({
  cells,
  facilities,
  selectedId,
  onSelect,
  paths,
  showPaths,
}: {
  cells: PublicCell[];
  facilities: Fac[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  paths: Path[];
  showPaths: boolean;
}) {
  const dark = usePrefersDark();
  const tiles = dark ? TILES.dark : TILES.light;
  const selected = cells.find((c) => c.id === selectedId) ?? null;
  return (
    <MapContainer center={MAP_CENTER} zoom={typeof window !== "undefined" && window.innerWidth < 768 ? MAP_ZOOM + 0.5 : MAP_ZOOM + 1} zoomSnap={0.5} className="h-full w-full" zoomControl={false}>
      <TileLayer key={tiles.className} url={tiles.url} attribution={tiles.attribution} className={tiles.className} />
      <ZoomControl position="bottomright" />
      <FitTo cell={selected} />
      {showPaths &&
        paths.map((p) => (
          <Polyline
            key={p.facilityId}
            positions={p.points.map((q) => [q.lat, q.lon])}
            pathOptions={{ color: "#7c5cff", weight: 3, dashArray: "2 8", lineCap: "round", opacity: 0.9 }}
          >
            <Tooltip className="aeris-tip" sticky>
              Estimated air movement over the next ~2 h (forecast wind). Not a measurement of odor.
            </Tooltip>
          </Polyline>
        ))}
      {cells.map((c) => {
        const col = rampColor(c.medianIntensity);
        const sel = c.id === selectedId;
        return (
          <Polygon
            key={c.id}
            positions={c.polygon}
            pathOptions={{
              color: sel ? (dark ? "#ffffff" : "#111418") : col,
              weight: sel ? 3 : 1.5,
              fillColor: col,
              fillOpacity: sel ? 0.55 : 0.38,
              lineJoin: "round",
            }}
            eventHandlers={{ click: () => onSelect(sel ? null : c.id) }}
          >
            <Tooltip className="aeris-tip" direction="top">
              {c.count} reports · median {c.medianIntensity} ({intensityInfo(c.medianIntensity).short})
            </Tooltip>
          </Polygon>
        );
      })}
      {facilities.map((f) => (
        <Marker key={f.id} position={[f.lat, f.lon]} icon={facilityIcon(f.type)}>
          <Tooltip className="aeris-tip" direction="top" offset={[0, -14]}>
            <strong>{f.name}</strong>
            {f.approx && <div className="text-[11px] opacity-70">Location approximate</div>}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
