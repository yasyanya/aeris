// Free, keyless tile sources. OpenStreetMap's standard tiles are styled with CSS
// filters (see globals.css: .tiles-muted / .tiles-dark) to get the muted greyscale
// look from the design references. For production traffic, follow the OSM tile
// usage policy or switch to a self-hosted / paid provider (e.g. Protomaps).
const OSM = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

export const TILES = {
  light: { ...OSM, className: "tiles-muted" },
  dark: { ...OSM, className: "tiles-dark" },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics",
    className: "",
  },
  roads: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
    attribution: "",
    className: "tiles-faint",
  },
  labels: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    attribution: "Labels &copy; Esri",
    className: "",
  },
} as const;

export const FACILITY_GLYPH: Record<string, string> = {
  landfill: "L",
  compost: "C",
  agriculture: "A",
  wastewater: "W",
  industrial: "I",
  other: "•",
};
