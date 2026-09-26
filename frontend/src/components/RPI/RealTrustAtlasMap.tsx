'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RpiData } from '@/types';
import { MAP_CONFIG, MAPBOX_ACCESS_TOKEN } from '@/lib/mapConfig';
import { getRpiMapGeoJson, RpiMapGeoJson } from '@/lib/api';
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Layers,
  ShieldCheck,
  Satellite,
  Mountain,
  SunMedium,
  Globe2,
  Search,
  CheckCircle2,
} from 'lucide-react';

interface RealTrustAtlasMapProps {
  stations: RpiData[];
  selectedCity?: string | null;
  onSelectCity?: (city: string) => void;
}

type TileType = 'satellite' | 'terrain' | 'positron' | 'osm';

const MODEL_STYLE_MAP: Record<string, { hex: string; label: string }> = {
  ECMWF: { hex: '#2563eb', label: 'ECMWF IFS (European Centre)' },
  ICON: { hex: '#10b981', label: 'ICON Seamless (DWD Germany)' },
  GFS: { hex: '#8b5cf6', label: 'GFS Global (NOAA / NCEP)' },
  GEM: { hex: '#f97316', label: 'GEM Global (ECCC Canada)' },
};

export default function RealTrustAtlasMap({
  stations,
  selectedCity,
  onSelectCity,
}: RealTrustAtlasMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});

  // Active Tile Layer State (Default to satellite if Mapbox token exists, else positron)
  const [activeTile, setActiveTile] = useState<TileType>(MAPBOX_ACCESS_TOKEN ? 'satellite' : 'positron');
  const [searchQuery, setSearchQuery] = useState('');
  const [geoJsonData, setGeoJsonData] = useState<RpiMapGeoJson | null>(null);
  const [apiConnected, setApiConnected] = useState<boolean>(false);

  // 1. Fetch GeoJSON from /api/rpi/map Map API
  useEffect(() => {
    let mounted = true;
    getRpiMapGeoJson()
      .then((data) => {
        if (mounted && data) {
          setGeoJsonData(data);
          setApiConnected(true);
        }
      })
      .catch(() => {
        if (mounted) setApiConnected(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: MAP_CONFIG.defaultCenter,
      zoom: MAP_CONFIG.defaultZoom,
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
      maxBounds: [[6.0, 68.0], [38.0, 98.0]] as L.LatLngBoundsExpression,
      maxBoundsViscosity: 0.85,
      zoomControl: false,
      attributionControl: false,
    });

    const tileInfo = MAP_CONFIG.tiles[activeTile] || MAP_CONFIG.tiles['positron'];
    const tileLayer = L.tileLayer(tileInfo.url, {
      maxZoom: tileInfo.maxZoom,
      tileSize: tileInfo.tileSize || 256,
      subdomains: ('subdomains' in tileInfo && tileInfo.subdomains) ? tileInfo.subdomains : 'abc',
    }).addTo(map);

    tileLayerRef.current = tileLayer;
    mapInstanceRef.current = map;

    const timer1 = setTimeout(() => map.invalidateSize(), 150);
    const timer2 = setTimeout(() => map.invalidateSize(), 500);

    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('resize', onResize);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 3. Tile Layer Switching
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const tileInfo = MAP_CONFIG.tiles[activeTile] || MAP_CONFIG.tiles['positron'];
    tileLayerRef.current.setUrl(tileInfo.url);
    mapInstanceRef.current.invalidateSize();
  }, [activeTile]);

  // Combined Station Data from GeoJSON API or Props
  const displayStations: RpiData[] = useMemo(() => {
    if (geoJsonData && geoJsonData.features && geoJsonData.features.length > 0) {
      return geoJsonData.features.map((f) => ({
        city: f.properties.city,
        state: f.properties.state,
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
        rpiScore: f.properties.rpiScore,
        priority: f.properties.priority,
        dominantModel: f.properties.dominantModel,
        rainfall: f.properties.rainfall,
        temperature: f.properties.temperature,
        wind: f.properties.wind,
        confidence: f.properties.confidence,
        rainRisk: Math.min(100, Math.round((f.properties.rainfall / 80) * 100)),
        heatRisk: Math.min(100, Math.max(0, Math.round(((f.properties.temperature - 25) / 20) * 100))),
        windRisk: Math.min(100, Math.round((f.properties.wind / 65) * 100)),
        modelWeights: { ecmwf: 45, icon: 25, gfs: 18, gem: 12 },
        recommendations: [],
        updatedAt: '2026-09-26T18:30:00Z',
      }));
    }
    return stations;
  }, [geoJsonData, stations]);

  // 4. Render Markers with Dominant-Model Color-Coding
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || displayStations.length === 0) return;

    // Clear old markers
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    const isDarkBg = activeTile === 'satellite' || activeTile === 'terrain';

    displayStations.forEach((st) => {
      const isSelected = selectedCity?.toLowerCase() === st.city.toLowerCase();
      const dom = (st.dominantModel || 'ECMWF').toUpperCase();
      const modelStyle = MODEL_STYLE_MAP[dom] || MODEL_STYLE_MAP['ECMWF'];
      const color = modelStyle.hex;

      const markerHtml = `
        <div class="relative flex items-center justify-center group cursor-pointer" style="width: ${
          isSelected ? '44px' : '32px'
        }; height: ${isSelected ? '44px' : '32px'};">
          <!-- Pulse animation on selected or high risk -->
          <div class="absolute inset-0 rounded-full animate-ping ${
            isSelected ? 'opacity-70' : 'opacity-25'
          }" style="background-color: ${color};"></div>
          
          ${
            isSelected
              ? `<div class="absolute -inset-2 rounded-full border-2 animate-pulse shadow-lg" style="border-color: ${color};"></div>`
              : ''
          }

          <!-- Outer Core with Model Initial -->
          <div class="relative ${
            isSelected ? 'w-6 h-6 ring-4 ring-white shadow-xl' : 'w-4 h-4 ring-2 ring-white shadow-md'
          } rounded-full flex items-center justify-center transition-all duration-200" style="background-color: ${color};">
            <span class="text-[9px] font-black text-white leading-none">${dom[0]}</span>
          </div>

          <!-- Station Tag -->
          <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded text-[9.5px] font-bold shadow-xs border pointer-events-none transition-all ${
            isSelected
              ? 'bg-slate-900 text-white border-slate-700 z-30 scale-105'
              : isDarkBg
              ? 'bg-slate-900/90 text-white border-slate-700'
              : 'bg-white/95 text-slate-800 border-slate-200'
          }">
            <span>${st.city}</span>
            <span class="ml-1 text-[8.5px] font-semibold" style="color: ${color};">${dom}</span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-model-trust-marker',
        html: markerHtml,
        iconSize: isSelected ? [44, 44] : [32, 32],
        iconAnchor: isSelected ? [22, 22] : [16, 16],
      });

      const marker = L.marker([st.lat, st.lon], { icon: customIcon }).addTo(map);

      // Station Detail Popup
      const popupHtml = `
        <div style="font-family: inherit; min-width: 195px; padding: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            <strong style="font-size: 13px; color: #0f172a; text-transform: uppercase;">${st.city}</strong>
            <span style="font-size: 10px; font-weight: 700; color: #2563eb; background: #eff6ff; padding: 2px 6px; border-radius: 9999px;">${st.state}</span>
          </div>
          <div style="margin-bottom: 6px;">
            <span style="font-size: 10px; color: #64748b; display: block;">Dominant NWP Model:</span>
            <span style="font-size: 12px; font-weight: 800; color: ${color};">${dom} (${modelStyle.label.split(' ')[0]})</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; font-size: 11px; background: #f8fafc; padding: 6px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div><span style="color: #64748b; font-size: 9.5px; display: block;">RPI Score</span><strong style="font-size: 12px; color: #0f172a;">${st.rpiScore}/100</strong></div>
            <div><span style="color: #64748b; font-size: 9.5px; display: block;">Confidence</span><strong style="font-size: 12px; color: #059669;">${st.confidence}%</strong></div>
            <div><span style="color: #64748b; font-size: 9.5px; display: block;">Rainfall</span><strong style="font-size: 11px; color: #0284c7;">${st.rainfall} mm</strong></div>
            <div><span style="color: #64748b; font-size: 9.5px; display: block;">Temp</span><strong style="font-size: 11px; color: #ea580c;">${st.temperature}°C</strong></div>
          </div>
          <div style="margin-top: 6px; font-size: 9.5px; color: #64748b; text-align: center;">Click to update EOC Resource Protocols</div>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        closeButton: true,
        offset: [0, -10],
      });

      marker.on('click', () => {
        map.flyTo([st.lat, st.lon], 8, { duration: 1.2 });
        if (onSelectCity) onSelectCity(st.city);
      });

      markersRef.current[st.city] = marker;
    });
  }, [displayStations, selectedCity, onSelectCity, activeTile]);

  // 5. Auto Pan / Zoom to Selected City
  useEffect(() => {
    if (!selectedCity || !mapInstanceRef.current) return;
    const match = displayStations.find((s) => s.city.toLowerCase() === selectedCity.toLowerCase());
    if (match) {
      mapInstanceRef.current.flyTo([match.lat, match.lon], 8, { duration: 1.2 });
      const m = markersRef.current[match.city];
      if (m) m.openPopup();
    }
  }, [selectedCity, displayStations]);

  // Handle Search Input
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const match = displayStations.find((s) =>
      s.city.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );
    if (match) {
      mapInstanceRef.current?.flyTo([match.lat, match.lon], 8, { duration: 1.2 });
      const m = markersRef.current[match.city];
      if (m) m.openPopup();
      if (onSelectCity) onSelectCity(match.city);
    }
  };

  return (
    <div className="relative w-full h-[560px] rounded-2xl overflow-hidden shadow-inner border border-slate-200/80">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Floating Bar: Map API Status & Station Search */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2">
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Station / District..."
            className="w-48 sm:w-56 pl-8 pr-3 py-1.5 rounded-xl text-xs bg-white/95 backdrop-blur-md border border-slate-200 shadow-md text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </form>

        <div className="px-2.5 py-1.5 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-md flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
          <span
            className={`w-2 h-2 rounded-full ${
              apiConnected ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'
            }`}
          />
          <span>{MAPBOX_ACCESS_TOKEN ? 'Mapbox API (HD GL)' : 'Leaflet CartoDB API'}</span>
        </div>
      </div>

      {/* Top Right Floating Controls: Tile Switcher & Zoom */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
        {/* Tile Layer Selector Bar */}
        <div className="p-1 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-md flex items-center gap-1">
          <button
            onClick={() => setActiveTile('satellite')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTile === 'satellite'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            type="button"
            title="Satellite Streets"
          >
            <Satellite size={12} />
            <span className="hidden sm:inline">Satellite</span>
          </button>

          <button
            onClick={() => setActiveTile('terrain')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTile === 'terrain'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            type="button"
            title="Topographic Terrain"
          >
            <Mountain size={12} />
            <span className="hidden sm:inline">Terrain</span>
          </button>

          <button
            onClick={() => setActiveTile('positron')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTile === 'positron'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            type="button"
            title="Scientific Light Map"
          >
            <SunMedium size={12} />
            <span className="hidden sm:inline">Light</span>
          </button>

          <button
            onClick={() => setActiveTile('osm')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTile === 'osm'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            type="button"
            title="OpenStreetMap"
          >
            <Globe2 size={12} />
            <span className="hidden sm:inline">OSM</span>
          </button>
        </div>

        {/* Zoom & Reset Buttons */}
        <div className="flex flex-col gap-1 shadow-md">
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="w-8 h-8 rounded-lg bg-white/95 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-sm shadow-xs border border-slate-200 transition-all cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="w-8 h-8 rounded-lg bg-white/95 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-sm shadow-xs border border-slate-200 transition-all cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              mapInstanceRef.current?.flyTo(MAP_CONFIG.defaultCenter, MAP_CONFIG.defaultZoom, { duration: 1.2 });
            }}
            className="w-8 h-8 rounded-lg bg-white/95 text-slate-700 hover:bg-slate-100 flex items-center justify-center text-xs shadow-xs border border-slate-200 transition-all cursor-pointer"
            title="Reset View"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* Bottom Floating Legend Bar */}
      <div className="absolute bottom-4 left-4 z-20 px-3.5 py-2.5 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-lg flex flex-wrap items-center gap-4 text-xs font-semibold">
        <div className="flex items-center gap-1.5 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>Dominant Model:</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-600 ring-2 ring-blue-100" />
            <span className="text-slate-700">ECMWF</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
            <span className="text-slate-700">ICON</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-purple-500 ring-2 ring-purple-100" />
            <span className="text-slate-700">GFS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-orange-500 ring-2 ring-orange-100" />
            <span className="text-slate-700">GEM</span>
          </div>
        </div>
      </div>
    </div>
  );
}
