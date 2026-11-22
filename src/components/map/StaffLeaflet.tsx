"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap, ZoomControl } from "react-leaflet";
import { MAP_CENTER, MAP_ZOOM } from "@/lib/constants";
import { bearingDeg, destination, distanceM } from "@/lib/geo";
import { useIsDark } from "@/components/theme";
import { TILES, FACILITY_GLYPH } from "./tiles";
import { rampColor } from "./PublicLeaflet";

export type StaffPoint = { id: number; lat: number; lon: number; intensity: number; label?: string };
export type TrajPoint = { lat: number; lon: number; minutesBefore: number };
export type Fac = { id: number; name: string; type: string; lat: number; lon: number; is_public?: number };

const facIcon = (type: string, highlight: boolean, dark: boolean) =>
  L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="width:28px;height:28px;border-radius:9px;background:${highlight ? "#0f8c7a" : dark ? "#171a1f" : "#fff"};border:1.5px solid ${highlight ? "#0f8c7a" : dark ? "#eef0f3" : "#16191d"};display:flex;align-items:center;justify-content:center;font:600 12px var(--font-geist-sans),sans-serif;color:${highlight ? "#fff" : dark ? "#eef0f3" : "#16191d"};box-shadow:0 2px 8px rgb(0 0 0/.15)">${FACILITY_GLYPH[type] ?? "•"}</div>`,
  });

/** Soft band around the back-trajectory that widens with distance (uncertainty grows). */
function band(traj: { lat: number; lon: number }[]): [number, number][] {
  if (traj.length < 2) return [];
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  let along = 0;
  for (let i = 0; i < traj.length; i++) {
    if (i > 0) along += distanceM(traj[i - 1], traj[i]);
    const dir = bearingDeg(traj[Math.max(0, i - 1)], traj[Math.min(traj.length - 1, i + 1)]);
    const w = 150 + along * 0.24;
    const l = destination(traj[i], (dir + 270) % 360, w);
    const r = destination(traj[i], (dir + 90) % 360, w);
    left.push([l.lat, l.lon]);
    right.push([r.lat, r.lon]);
  }
  return [...left, ...right.reverse()];
}

function FocusOn({ point, trajectory }: { point: StaffPoint | null; trajectory: TrajPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (!point) return;
    const pts: [number, number][] = [[point.lat, point.lon], ...trajectory.map((t) => [t.lat, t.lon] as [number, number])];
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 14, animate: true });
    else map.setView([point.lat, point.lon], 14, { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point?.id, map]);
  return null;
}

export default function StaffLeaflet({
  points,
  facilities,
  selectedId,
  trajectory,
  highlightFacilities = [],
  onSelect,
  zoomPosition = "topright",
}: {
  points: StaffPoint[];
  facilities: Fac[];
  selectedId: number | null;
  trajectory: TrajPoint[];
  highlightFacilities?: number[];
  onSelect?: (id: number) => void;
  zoomPosition?: "topright" | "bottomright";
}) {
  const dark = useIsDark();
  const tiles = dark ? TILES.dark : TILES.light;
  const selected = points.find((p) => p.id === selectedId) ?? null;
  return (
    <MapContainer center={MAP_CENTER} zoom={MAP_ZOOM} className="h-full w-full" zoomControl={false}>
      <TileLayer key={tiles.className} url={tiles.url} attribution={tiles.attribution} className={tiles.className} />
      <ZoomControl position={zoomPosition} />
      <FocusOn point={selected} trajectory={trajectory} />

      {trajectory.length > 1 && (
        <>
          <Polygon positions={band(trajectory)} pathOptions={{ stroke: false, fillColor: "#7c5cff", fillOpacity: 0.18 }} interactive={false} />
          <Polyline
            positions={trajectory.map((t) => [t.lat, t.lon])}
            pathOptions={{ color: dark ? "#eef0f3" : "#16191d", weight: 2.5, dashArray: "3 7", lineCap: "round" }}
          >
            <Tooltip className="aeris-tip" sticky>
              Estimated path the air took to reach this spot (last ~3 h)
            </Tooltip>
          </Polyline>
        </>
      )}

      {points.map((p) => {
        const sel = p.id === selectedId;
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lon]}
            radius={sel ? 9 : 6}
            pathOptions={{
              color: sel ? (dark ? "#ffffff" : "#16191d") : dark ? "#0f1114" : "#ffffff",
              weight: sel ? 3 : 1.5,
              fillColor: rampColor(p.intensity),
              fillOpacity: 1,
            }}
            eventHandlers={{ click: () => onSelect?.(p.id) }}
          >
            {p.label && (
              <Tooltip className="aeris-tip" direction="top" offset={[0, -6]}>
                {p.label}
              </Tooltip>
            )}
          </CircleMarker>
        );
      })}

      {facilities.map((f) => (
        <Marker key={`f${f.id}`} position={[f.lat, f.lon]} icon={facIcon(f.type, highlightFacilities.includes(f.id), dark)}>
          <Tooltip className="aeris-tip" direction="top" offset={[0, -14]}>
            <strong>{f.name}</strong>
            {f.is_public === 0 && <div className="text-[11px] opacity-70">Not shown on the public map</div>}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
