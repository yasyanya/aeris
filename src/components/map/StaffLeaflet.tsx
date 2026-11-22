"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Fragment, useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap, ZoomControl } from "react-leaflet";
import { MAP_CENTER, MAP_ZOOM } from "@/lib/constants";
import { bearingDeg, destination, distanceM } from "@/lib/geo";
import { SCREENING } from "@/lib/screening";
import { TILES, FACILITY_GLYPH } from "./tiles";
import { rampColor } from "./PublicLeaflet";

export type StaffPoint = { id: number; lat: number; lon: number; intensity: number; label?: string };
export type Overlay = {
  reportId: number;
  lat: number;
  lon: number;
  fromDeg: number | null;
  toleranceDeg: number | null;
  trajectory: { lat: number; lon: number; minutesBefore: number }[];
};
export type Fac = { id: number; name: string; type: string; lat: number; lon: number; is_public?: number };
export type WindPt = { lat: number; lon: number; speedMph: number | null; fromDeg: number | null };

const facIcon = (type: string, highlight: boolean) =>
  L.divIcon({
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<div style="width:30px;height:30px;border-radius:50%;background:${highlight ? "#ff6a2b" : "#15181e"};border:2px solid ${highlight ? "#fff" : "#ff6a2b"};display:flex;align-items:center;justify-content:center;font:600 12px var(--font-geist-sans),sans-serif;color:#fff;box-shadow:0 0 0 4px rgb(255 106 43/.18)">${FACILITY_GLYPH[type] ?? "•"}</div>`,
  });

const windIcon = (fromDeg: number, speed: number) =>
  L.divIcon({
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<svg width="30" height="30" viewBox="0 0 30 30" style="transform:rotate(${(fromDeg + 180) % 360}deg);opacity:${speed < 2 ? 0.25 : 0.55}"><path d="M15 4v20M15 4l-5 6M15 4l5 6" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`,
  });

const nodeIcon = L.divIcon({
  className: "",
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  html: `<div style="width:12px;height:12px;border-radius:50%;background:#fff;border:2px solid #0e1014"></div>`,
});

function cone(o: { lat: number; lon: number }, fromDeg: number, tol: number, r = SCREENING.MAX_DISTANCE_M): [number, number][] {
  const pts: [number, number][] = [[o.lat, o.lon]];
  for (let a = -tol; a <= tol + 0.01; a += tol / 8) {
    const p = destination(o, (fromDeg + a + 360) % 360, r);
    pts.push([p.lat, p.lon]);
  }
  return pts;
}

/** Uncertainty band around the back-trajectory that widens with travel distance. */
function band(traj: { lat: number; lon: number }[], tolDeg: number): [number, number][] {
  if (traj.length < 2) return [];
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  let along = 0;
  for (let i = 0; i < traj.length; i++) {
    if (i > 0) along += distanceM(traj[i - 1], traj[i]);
    const a = traj[Math.max(0, i - 1)];
    const b = traj[Math.min(traj.length - 1, i + 1)];
    const dir = bearingDeg(a, b);
    const w = 150 + along * Math.tan(((tolDeg * 0.6) * Math.PI) / 180);
    const l = destination(traj[i], (dir + 270) % 360, w);
    const r = destination(traj[i], (dir + 90) % 360, w);
    left.push([l.lat, l.lon]);
    right.push([r.lat, r.lon]);
  }
  return [...left, ...right.reverse()];
}

function FitOverlays({ overlays, fitKey }: { overlays: Overlay[]; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (!overlays.length) return;
    const pts: [number, number][] = [];
    overlays.forEach((o) => {
      pts.push([o.lat, o.lon]);
      o.trajectory.forEach((t) => pts.push([t.lat, t.lon]));
    });
    map.fitBounds(L.latLngBounds(pts).pad(0.35), { maxZoom: 15, animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map]);
  return null;
}

export default function StaffLeaflet({
  base,
  points,
  facilities,
  selectedIds,
  overlays,
  windField,
  alerts = [],
  highlightFacilities = [],
  onSelect,
  center,
  zoom,
  showCones = true,
}: {
  base: "satellite" | "dark";
  points: StaffPoint[];
  facilities: Fac[];
  selectedIds: number[];
  overlays: Overlay[];
  windField: WindPt[];
  alerts?: { lat: number; lon: number }[];
  highlightFacilities?: number[];
  onSelect?: (id: number, additive: boolean) => void;
  center?: [number, number];
  zoom?: number;
  showCones?: boolean;
}) {
  const fitKey = useMemo(() => overlays.map((o) => o.reportId).join(","), [overlays]);
  return (
    <MapContainer center={center ?? MAP_CENTER} zoom={zoom ?? MAP_ZOOM} className="h-full w-full" zoomControl={false}>
      {base === "satellite" ? (
        <>
          <TileLayer key="sat" url={TILES.satellite.url} attribution={TILES.satellite.attribution} maxZoom={19} />
          <TileLayer key="rd" url={TILES.roads.url} attribution="" className={TILES.roads.className} />
          <TileLayer key="lbl" url={TILES.labels.url} attribution={TILES.labels.attribution} />
        </>
      ) : (
        <TileLayer key="dark" url={TILES.dark.url} attribution={TILES.dark.attribution} className={TILES.dark.className} />
      )}
      <ZoomControl position="topright" />
      <FitOverlays overlays={overlays} fitKey={fitKey} />

      {windField.map((w, i) =>
        w.fromDeg != null && w.speedMph != null ? (
          <Marker key={`w${i}`} position={[w.lat, w.lon]} icon={windIcon(w.fromDeg, w.speedMph)} interactive={false} />
        ) : null,
      )}

      {overlays.map((o) => (
        <Fragment key={`ov${o.reportId}`}>
          {showCones && o.fromDeg != null && o.toleranceDeg != null && (
            <Polygon
              positions={cone(o, o.fromDeg, o.toleranceDeg)}
              pathOptions={{ color: "#ff6a2b", weight: 1, dashArray: "4 4", fillColor: "#ff6a2b", fillOpacity: 0.08 }}
              interactive={false}
            />
          )}
          {o.trajectory.length > 1 && (
            <>
              <Polygon
                positions={band(o.trajectory, o.toleranceDeg ?? SCREENING.BASE_TOL)}
                pathOptions={{ stroke: false, fillColor: "#7c5cff", fillOpacity: 0.32 }}
                interactive={false}
              />
              <Polyline positions={o.trajectory.map((t) => [t.lat, t.lon])} pathOptions={{ color: "#ffffff", weight: 2.5 }} interactive={false} />
              {o.trajectory
                .filter((t) => t.minutesBefore > 0 && t.minutesBefore % 20 === 0)
                .map((t) => (
                  <Marker key={`n${o.reportId}-${t.minutesBefore}`} position={[t.lat, t.lon]} icon={nodeIcon}>
                    <Tooltip className="aeris-tip" direction="top">
                      Air position ~{t.minutesBefore} min before the observation
                    </Tooltip>
                  </Marker>
                ))}
            </>
          )}
        </Fragment>
      ))}

      {alerts.map((a, i) => (
        <CircleMarker
          key={`a${i}`}
          center={[a.lat, a.lon]}
          radius={34}
          pathOptions={{ color: "#ff6a2b", weight: 2, dashArray: "3 5", fillColor: "#ff6a2b", fillOpacity: 0.08 }}
          interactive={false}
        />
      ))}

      {points.map((p) => {
        const sel = selectedIds.includes(p.id);
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lon]}
            radius={sel ? 9 : 6.5}
            pathOptions={{ color: sel ? "#ffffff" : "#0e1014", weight: sel ? 3 : 1.5, fillColor: rampColor(p.intensity), fillOpacity: 1 }}
            eventHandlers={{
              click: (e) => onSelect?.(p.id, !!(e.originalEvent as MouseEvent).shiftKey || !!(e.originalEvent as MouseEvent).metaKey),
            }}
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
        <Marker key={`f${f.id}`} position={[f.lat, f.lon]} icon={facIcon(f.type, highlightFacilities.includes(f.id))}>
          <Tooltip className="aeris-tip" direction="top" offset={[0, -14]}>
            <strong>{f.name}</strong>
            {f.is_public === 0 && <div className="text-[11px] opacity-70">Hidden from public map</div>}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
