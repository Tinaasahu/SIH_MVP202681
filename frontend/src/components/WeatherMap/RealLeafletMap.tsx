'use client';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCityForecastsData, MOCK_CITIES, MOCK_REGION_DOMINANCE } from '@/lib/api';
import { CityForecast, MapLayer } from '@/types';
import { MAP_CONFIG, MAPBOX_ACCESS_TOKEN } from '@/lib/mapConfig';
import { getRiskColor } from '@/lib/utils';
import { RotateCcw, ZoomIn, ZoomOut, Sparkles, Satellite, Mountain, SunMedium, Globe2 } from 'lucide-react';

interface RealLeafletMapProps {
  layer: MapLayer;
  leadTime: string;
  selectedCity?: string | null;
  onSelectCity?: (city: CityForecast) => void;
}

type TileType = 'satellite' | 'terrain' | 'positron' | 'osm';

function getCityMetric(city: CityForecast, layer: MapLayer): { text: string; color: string } {
  switch (layer) {
    case 'rainfall': {
      const color = city.rainfall > 80 ? '#0284c7' : city.rainfall > 50 ? '#0ea5e9' : city.rainfall > 20 ? '#38bdf8' : '#7dd3fc';
      return { text: `${city.rainfall} mm`, color };
    }
    case 'temperature': {
      const color = city.temperature > 35 ? '#ef4444' : city.temperature > 30 ? '#f97316' : city.temperature > 25 ? '#eab308' : '#10b981';
      return { text: `${city.temperature}°C`, color };
    }
    case 'wind': {
      const color = city.wind > 25 ? '#7c3aed' : city.wind > 18 ? '#8b5cf6' : '#a855f7';
      return { text: `${city.wind} km/h`, color };
    }
    case 'extreme_risk':
      return { text: city.risk.toUpperCase(), color: getRiskColor(city.risk) };
    case 'model_dominance':
      return { text: city.dominantModel, color: '#2563eb' };
    case 'confidence': {
      const color = city.confidence >= 85 ? '#10b981' : city.confidence >= 75 ? '#f59e0b' : '#ef4444';
      return { text: `${city.confidence}%`, color };
    }
    default:
      return { text: `${city.rainfall} mm`, color: '#0ea5e9' };
  }
}

export default function RealLeafletMap({
  layer,
  leadTime,
  selectedCity,
  onSelectCity,
}: RealLeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  
  // Default to satellite if Mapbox token is present, otherwise standard osm
  const [activeTile, setActiveTile] = useState<TileType>(MAPBOX_ACCESS_TOKEN ? 'satellite' : 'osm');
  const [activeHoverCity, setActiveHoverCity] = useState<CityForecast | null>(null);
  const [cities, setCities] = useState<CityForecast[]>(MOCK_CITIES);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let mounted = true;
    getCityForecastsData()
      .then((data) => {
        if (mounted && data && data.length > 0) {
          setCities(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsError(true);
          setIsLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: MAP_CONFIG.defaultCenter,
      zoom: MAP_CONFIG.defaultZoom,
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
      zoomControl: false,
      attributionControl: false,
    });

    const initialTileKey = MAPBOX_ACCESS_TOKEN ? 'satellite' : 'osm';
    const tileInfo = MAP_CONFIG.tiles[initialTileKey];

    const tileLayer = L.tileLayer(tileInfo.url, {
      maxZoom: tileInfo.maxZoom,
      tileSize: 256,
      subdomains: ('subdomains' in tileInfo && tileInfo.subdomains) ? tileInfo.subdomains : 'abc',
    }).addTo(map);

    tileLayerRef.current = tileLayer;
    mapInstanceRef.current = map;

    // Critical fix: force Leaflet to recalculate container viewport dimensions
    const timer1 = setTimeout(() => map.invalidateSize(), 100);
    const timer2 = setTimeout(() => map.invalidateSize(), 400);

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

  // 2. Handle Tile Layer Switching
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const tileInfo = MAP_CONFIG.tiles[activeTile];
    tileLayerRef.current.setUrl(tileInfo.url);
    mapInstanceRef.current.invalidateSize();
  }, [activeTile]);

  // 3. Render Synoptic Weather Station Pulse Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old markers
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    const isDarkBg = activeTile === 'satellite';

    cities.forEach((city) => {
      const { text, color } = getCityMetric(city, layer);
      const isSelected = selectedCity ? city.city.toLowerCase() === selectedCity.toLowerCase() : false;

      const customIcon = L.divIcon({
        className: 'custom-weather-marker',
        html: `
          <div class="relative flex items-center justify-center group cursor-pointer" style="width: ${isSelected ? '44px' : '36px'}; height: ${isSelected ? '44px' : '36px'};">
            <!-- Radar Beacon Pulse Animation -->
            <div class="absolute inset-0 rounded-full animate-ping ${isSelected ? 'opacity-70' : 'opacity-35'}" style="background-color: ${color};"></div>
            
            ${isSelected ? `<div class="absolute -inset-1.5 rounded-full border-2 border-blue-500 animate-pulse shadow-md"></div>` : ''}

            <!-- Pinpoint Center Core -->
            <div class="relative ${isSelected ? 'w-5 h-5 scale-110' : 'w-4 h-4'} rounded-full border-2 border-white shadow-lg flex items-center justify-center" style="background-color: ${color};">
              <div class="${isSelected ? 'w-2 h-2' : 'w-1.5 h-1.5'} rounded-full bg-white"></div>
            </div>

            <!-- Crisp Weather Badge Label -->
            <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-md text-[10px] font-bold tracking-tight shadow-md border pointer-events-none transition-all duration-200 group-hover:scale-110 ${
              isSelected
                ? 'bg-blue-600 text-white border-white ring-2 ring-blue-300 z-30 scale-105'
                : isDarkBg
                ? 'bg-slate-900/90 text-white border-white/20'
                : 'bg-white/95 text-slate-800 border-slate-200/80'
            }">
              <span>${city.city}</span>
              <span class="ml-1 opacity-80 text-[9px] font-medium" style="color: ${isSelected ? '#ffffff' : color};">${text}</span>
            </div>
          </div>
        `,
        iconSize: isSelected ? [44, 44] : [36, 36],
        iconAnchor: isSelected ? [22, 22] : [18, 18],
      });

      const marker = L.marker([city.lat, city.lon], { icon: customIcon }).addTo(map);

      // Station detail popup
      const popupContent = `
        <div style="font-family: inherit; min-width: 170px; padding: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            <span style="font-weight: 800; font-size: 13px; color: #1e293b; text-transform: uppercase;">${city.city}</span>
            <span style="font-size: 10px; font-weight: 700; color: #2563eb; background: #eff6ff; padding: 2px 6px; border-radius: 9999px;">${city.state}</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; font-size: 11px;">
            <div><span style="color: #64748b; font-size: 10px; display: block;">Rainfall</span><strong style="color: #0284c7; font-size: 12px;">${city.rainfall} mm</strong></div>
            <div><span style="color: #64748b; font-size: 10px; display: block;">Temp</span><strong style="color: #ea580c; font-size: 12px;">${city.temperature}°C</strong></div>
            <div><span style="color: #64748b; font-size: 10px; display: block;">Wind</span><strong style="color: #7c3aed; font-size: 12px;">${city.wind} km/h</strong></div>
            <div><span style="color: #64748b; font-size: 10px; display: block;">Reliability</span><strong style="color: #059669; font-size: 12px;">${city.confidence}% ${city.confidenceLabel ? '(' + city.confidenceLabel + ')' : ''}</strong></div>
          </div>
          <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #f1f5f9; font-size: 10px; color: #64748b; display: flex; justify-content: space-between;">
            <span>Dominant Model:</span>
            <strong style="color: #1d4ed8;">${city.dominantModel}</strong>
          </div>
          ${city.explanation ? `
          <div style="margin-top: 4px; font-size: 9.5px; color: #475569; font-style: italic; background: #f8fafc; padding: 4px 6px; border-radius: 6px; border: 1px solid #e2e8f0; line-height: 1.3;">
            &quot;${city.explanation}&quot;
          </div>` : ''}
        </div>
      `;
      marker.bindPopup(popupContent, {
        closeButton: true,
        offset: [0, -12],
      });

      marker.on('mouseover', () => {
        setActiveHoverCity(city);
      });

      marker.on('click', () => {
        map.flyTo([city.lat, city.lon], 9, {
          duration: 1.4,
          easeLinearity: 0.25,
        });
        setActiveHoverCity(city);
        marker.openPopup();
        if (onSelectCity) onSelectCity(city);
      });

      markersRef.current[city.city] = marker;
    });
  }, [layer, activeTile, onSelectCity, cities, selectedCity]);

  // 4. Smooth FlyTo Zoom & Open Popup when city is selected
  useEffect(() => {
    if (!selectedCity || !mapInstanceRef.current) return;
    const target = cities.find((c) => c.city.toLowerCase() === selectedCity.toLowerCase());
    if (target) {
      mapInstanceRef.current.flyTo([target.lat, target.lon], 9, {
        duration: 1.4,
        easeLinearity: 0.25,
      });
      setActiveHoverCity(target);
      const marker = markersRef.current[target.city];
      if (marker) {
        marker.openPopup();
      }
    }
  }, [selectedCity, cities]);

  // Controls
  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleReset = () => {
    mapInstanceRef.current?.flyTo(MAP_CONFIG.defaultCenter, MAP_CONFIG.defaultZoom, {
      duration: 1.4,
    });
    setActiveHoverCity(null);
  };

  return (
    <div className="relative w-full h-[520px] rounded-2xl overflow-hidden shadow-inner">
      {/* Map Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Map Controls Bar */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2.5">
        {/* Zoom & Reset Controls */}
        <div className="flex flex-col bg-white/85 backdrop-blur-md rounded-xl p-1 shadow-lg border border-white/70">
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors"
            title="Zoom In"
            type="button"
          >
            <ZoomIn size={16} />
          </button>
          <div className="h-px bg-slate-200 my-0.5" />
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors"
            title="Zoom Out"
            type="button"
          >
            <ZoomOut size={16} />
          </button>
          <div className="h-px bg-slate-200 my-0.5" />
          <button
            onClick={handleReset}
            className="p-2 hover:bg-blue-50 text-slate-700 hover:text-blue-600 rounded-lg transition-colors"
            title="Reset to All-India View"
            type="button"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {/* Mapbox & Cartographic Tile Mode Switcher */}
        <div className="bg-white/85 backdrop-blur-md rounded-xl p-1.5 shadow-lg border border-white/70 flex flex-col gap-1 min-w-[130px]">
          <span className="text-[10px] font-bold text-slate-400 px-2 py-0.5 uppercase tracking-wider">
            Imagery
          </span>
          <button
            onClick={() => setActiveTile('satellite')}
            className={`flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all text-left ${
              activeTile === 'satellite'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            type="button"
          >
            <Satellite size={13} />
            <span>Satellite HD</span>
          </button>

          <button
            onClick={() => setActiveTile('terrain')}
            className={`flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all text-left ${
              activeTile === 'terrain'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            type="button"
          >
            <Mountain size={13} />
            <span>Terrain 3D</span>
          </button>

          <button
            onClick={() => setActiveTile('positron')}
            className={`flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all text-left ${
              activeTile === 'positron'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            type="button"
          >
            <SunMedium size={13} />
            <span>Scientific</span>
          </button>

          <button
            onClick={() => setActiveTile('osm')}
            className={`flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all text-left ${
              activeTile === 'osm'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            type="button"
          >
            <Globe2 size={13} />
            <span>Geographic</span>
          </button>
        </div>
      </div>

      {/* Floating Selected/Hovered Station Card */}
      {(() => {
        const activeCardCity = activeHoverCity || (selectedCity ? cities.find(c => c.city.toLowerCase() === selectedCity.toLowerCase()) : null) || cities[0];
        if (!activeCardCity) return null;

        return (
          <div
            className="absolute bottom-4 left-4 z-10 p-4 rounded-2xl shadow-xl border border-white/80 max-w-[260px] animate-in fade-in-50 slide-in-from-bottom-2 duration-200"
            style={{
              background: 'rgba(255, 255, 255, 0.90)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
            }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-sm font-extrabold uppercase tracking-wide text-slate-800">
                {activeCardCity.city}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100/70 text-blue-700 font-bold border border-blue-200/50">
                {activeCardCity.state}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] font-medium">Rainfall</span>
                <span className="font-extrabold text-sky-600 text-sm">{activeCardCity.rainfall} mm</span>
              </div>
              <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] font-medium">Temperature</span>
                <span className="font-extrabold text-orange-600 text-sm">{activeCardCity.temperature}°C</span>
              </div>
              <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] font-medium">Wind Speed</span>
                <span className="font-extrabold text-purple-600 text-sm">{activeCardCity.wind} km/h</span>
              </div>
              <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] font-medium">Confidence</span>
                <span className="font-extrabold text-emerald-600 text-sm">{activeCardCity.confidence}%</span>
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Dominant Model:</span>
              <span className="font-bold text-blue-700">{activeCardCity.dominantModel}</span>
            </div>
            {activeCardCity.confidenceLabel && (
              <div className="mt-1 text-[10px] text-slate-500 flex items-center justify-between">
                <span>Rating:</span>
                <span className="font-semibold text-emerald-600">{activeCardCity.confidenceLabel}</span>
              </div>
            )}
            {activeCardCity.explanation && (
              <div className="mt-1.5 pt-1.5 border-t border-slate-100/80 text-[10px] text-slate-500 italic leading-snug">
                &quot;{activeCardCity.explanation}&quot;
              </div>
            )}
          </div>
        );
      })()}

      {/* Model Dominance Overlay */}
      {layer === 'model_dominance' && (
        <div
          className="absolute top-4 left-4 z-10 rounded-2xl p-3.5 shadow-lg border border-white/80 max-w-[220px]"
          style={{
            background: 'rgba(255, 255, 255, 0.90)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="text-[11px] font-bold text-slate-800 mb-2 flex items-center gap-1.5">
            <Sparkles size={13} className="text-blue-600" />
            REGIONAL DOMINANCE
          </div>
          <div className="space-y-1.5 text-[11px] text-slate-600">
            {MOCK_REGION_DOMINANCE.slice(0, 4).map((r) => (
              <div key={r.region} className="flex justify-between items-center">
                <span className="text-slate-400">{r.region}:</span>
                <span className="font-bold text-slate-800">{r.dominantModel}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaflet CSS Overrides to Prevent Tailwind `img` Reset Collisions */}
      <style jsx global>{`
        .custom-weather-marker {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-container {
          font-family: inherit !important;
          background: #0f172a !important;
        }
        /* CRITICAL: Overrides Tailwind CSS default img rules for Leaflet tiles */
        .leaflet-container img,
        .leaflet-tile-container img,
        .leaflet-tile {
          max-width: none !important;
          max-height: none !important;
          width: 256px !important;
          height: 256px !important;
          box-shadow: none !important;
          border: none !important;
          border-radius: 0 !important;
        }
      `}</style>
    </div>
  );
}
