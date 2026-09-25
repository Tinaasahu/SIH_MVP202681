/**
 * Map Configuration for Hybrid WX
 * 
 * MAPBOX SATELLITE & TERRAIN TILES:
 * Configured securely via NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN environment variable.
 */

export const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

export const MAP_CONFIG = {
  // Center of India
  defaultCenter: [22.5937, 78.9629] as [number, number],
  defaultZoom: 4.8,
  minZoom: 3.5,
  maxZoom: 18,
  
  tiles: {
    // Mapbox High-Res Satellite with State Borders, Rivers, and Labels
    satellite: {
      name: "Satellite Streets (HD)",
      url: MAPBOX_ACCESS_TOKEN
        ? `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_ACCESS_TOKEN}`
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      attribution: '&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      tileSize: 256,
      subdomains: "abc",
      zoomOffset: 0,
    },
    // Mapbox High-Detail Topographic / Meteorological Terrain
    terrain: {
      name: "Topographic Terrain",
      url: MAPBOX_ACCESS_TOKEN
        ? `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_ACCESS_TOKEN}`
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: '&copy; <a href="https://www.mapbox.com/">Mapbox</a>',
      maxZoom: 19,
      tileSize: 256,
      subdomains: "abc",
      zoomOffset: 0,
    },
    // Light Scientific (CartoDB Positron)
    positron: {
      name: "Light Scientific",
      url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
      tileSize: 256,
      zoomOffset: 0,
    },
    // Standard Geographic OpenStreetMap
    osm: {
      name: "Standard Geographic",
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: "abc",
      maxZoom: 19,
      tileSize: 256,
      zoomOffset: 0,
    },
  }
};
