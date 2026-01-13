// src/mapStyles.js

export const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

// Raster (satellite imagery) — your current Esri one
export const BASEMAPS = {
  satellite: {
    label: "Satellite",
    type: "raster",
    style: {
      version: 8,
      sources: {
        satellite: {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          ],
          tileSize: 256,
          attribution: "&copy; Esri"
        }
      },
      layers: [{ id: "satellite-layer", type: "raster", source: "satellite" }]
    }
  },

  // MapTiler vector styles
  streets: { label: "Streets", type: "vector", style: `https://api.maptiler.com/maps/streets-v4/style.json?key=${MAPTILER_KEY}` },
  topo:    { label: "Topo",    type: "vector", style: `https://api.maptiler.com/maps/topo-v4/style.json?key=${MAPTILER_KEY}` },
  outdoor: { label: "Outdoor", type: "vector", style: `https://api.maptiler.com/maps/outdoor-v4/style.json?key=${MAPTILER_KEY}` },
  winter:  { label: "Winter",  type: "vector", style: `https://api.maptiler.com/maps/winter-v4/style.json?key=${MAPTILER_KEY}` },
  basic:   { label: "Basic",   type: "vector", style: `https://api.maptiler.com/maps/basic-v2/style.json?key=${MAPTILER_KEY}` }
};
