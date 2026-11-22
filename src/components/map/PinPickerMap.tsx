"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents, Tooltip } from "react-leaflet";
import { MAP_CENTER, MAP_ZOOM } from "@/lib/constants";
import { TILES, FACILITY_GLYPH } from "./tiles";

type Pt = { lat: number; lon: number };
type Fac = { id: number; name: string; type: string; lat: number; lon: number };

const pinIcon = L.divIcon({
  className: "",
  iconSize: [36, 46],
  iconAnchor: [18, 44],
  html: `<svg width="36" height="46" viewBox="0 0 36 46"><path d="M18 45c0 0 15-16.3 15-27A15 15 0 0 0 3 18c0 10.7 15 27 15 27z" fill="#111418"/><circle cx="18" cy="18" r="6" fill="#c6f432"/></svg>`,
});

export const facilityIcon = (type: string) =>
  L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="width:28px;height:28px;border-radius:9px;background:#ffffff;border:1.5px solid #111418;display:flex;align-items:center;justify-content:center;font:600 12px var(--font-geist-sans),sans-serif;color:#111418;box-shadow:0 2px 8px rgb(0 0 0/.15)">${FACILITY_GLYPH[type] ?? "•"}</div>`,
  });

function ClickToPlace({ onPick }: { onPick: (p: Pt) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lon: e.latlng.lng }) });
  return null;
}

function FlyTo({ point }: { point: Pt | null }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.flyTo([point.lat, point.lon], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [point, map]);
  return null;
}

export default function PinPickerMap({
  value,
  onChange,
  flyTarget,
  facilities,
}: {
  value: Pt | null;
  onChange: (p: Pt) => void;
  flyTarget: Pt | null;
  facilities: Fac[];
}) {
  const handlers = useMemo(
    () => ({
      dragend(e: L.LeafletEvent) {
        const ll = (e.target as L.Marker).getLatLng();
        onChange({ lat: ll.lat, lon: ll.lng });
      },
    }),
    [onChange],
  );
  return (
    <MapContainer center={MAP_CENTER} zoom={MAP_ZOOM + 1} className="h-full w-full" zoomControl={false} attributionControl>
      <TileLayer url={TILES.light.url} attribution={TILES.light.attribution} className={TILES.light.className} />
      <ClickToPlace onPick={onChange} />
      <FlyTo point={flyTarget} />
      {facilities.map((f) => (
        <Marker key={f.id} position={[f.lat, f.lon]} icon={facilityIcon(f.type)} interactive>
          <Tooltip className="aeris-tip" direction="top" offset={[0, -14]}>
            {f.name}
          </Tooltip>
        </Marker>
      ))}
      {value && <Marker position={[value.lat, value.lon]} icon={pinIcon} draggable eventHandlers={handlers} keyboard />}
    </MapContainer>
  );
}
