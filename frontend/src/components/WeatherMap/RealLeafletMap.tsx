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
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    let mounted = true;
    const leadDays = leadTime === '72h' ? 3 : leadTime === '48h' ? 2 : 1;
    setIsLoading(true);
    getCityForecastsData(leadDays)
      .then((data) => {
        if (mounted) {
          if (data && data.length > 0) {
            setCities(data);
            setIsFallback(false);
          } else {
            setIsFallback(true);
          }
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsError(true);
          setIsFallback(true);
          setIsLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [leadTime]);

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
        <div style="font-family: inherit; min-width: 170px; padding: 4px; color: #F5F7FF;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 4px;">
            <span style="font-weight: 800; font-size: 13px; color: #F5F7FF; text-transform: uppercase;">${city.city}</span>
            <span style="font-size: 10px; font-weight: 700; color: #38bdf8; background: rgba(56,189,248,0.15); border: 1px solid rgba(56,189,248,0.3); padding: 2px 6px; border-radius: 9999px;">${city.state}</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px 8px; font-size: 11px;">
            <div style="background: rgba(14,27,68,0.6); padding: 4px 6px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);"><span style="color: #AAB7D4; font-size: 9.5px; display: block;">Rainfall</span><strong style="color: #38bdf8; font-size: 12px;">${city.rainfall} mm</strong></div>
            <div style="background: rgba(14,27,68,0.6); padding: 4px 6px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);"><span style="color: #AAB7D4; font-size: 9.5px; display: block;">Temp</span><strong style="color: #f59e0b; font-size: 12px;">${city.temperature}°C</strong></div>
            <div style="background: rgba(14,27,68,0.6); padding: 4px 6px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);"><span style="color: #AAB7D4; font-size: 9.5px; display: block;">Wind</span><strong style="color: #c084fc; font-size: 12px;">${city.wind} km/h</strong></div>
            <div style="background: rgba(14,27,68,0.6); padding: 4px 6px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);"><span style="color: #AAB7D4; font-size: 9.5px; display: block;">Reliability</span><strong style="color: #34d399; font-size: 12px;">${city.confidence}% ${city.confidenceLabel ? '(' + city.confidenceLabel + ')' : ''}</strong></div>
          </div>
          <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 10px; color: #AAB7D4; display: flex; justify-content: space-between;">
            <span>Dominant Model:</span>
            <strong style="color: #38bdf8;">${city.dominantModel}</strong>
          </div>
          ${city.explanation ? `
          <div style="margin-top: 4px; font-size: 9.5px; color: #AAB7D4; font-style: italic; background: rgba(14,27,68,0.5); padding: 4px 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); line-height: 1.3;">
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

      {/* Fallback Warning */}
      {isFallback && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs font-semibold backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Demo data (backend unavailable)
        </div>
      )}

      {/* Floating Map Controls Bar */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2.5">
        {/* Zoom & Reset Controls */}
        <div className="flex flex-col bg-[rgba(11,22,56,0.88)] backdrop-blur-xl rounded-xl p-1 shadow-2xl border border-white/15">
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-white/10 rounded-lg text-[#F5F7FF] transition-colors"
            title="Zoom In"
            type="button"
          >
            <ZoomIn size={16} />
          </button>
          <div className="h-px bg-white/10 my-0.5" />
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-white/10 rounded-lg text-[#F5F7FF] transition-colors"
            title="Zoom Out"
            type="button"
          >
            <ZoomOut size={16} />
          </button>
          <div className="h-px bg-white/10 my-0.5" />
          <button
            onClick={handleReset}
            className="p-2 hover:bg-sky-500/20 text-[#AAB7D4] hover:text-sky-300 rounded-lg transition-colors"
            title="Reset to All-India View"
            type="button"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {/* Mapbox & Cartographic Tile Mode Switcher */}
        <div className="bg-[rgba(11,22,56,0.88)] backdrop-blur-xl rounded-xl p-1.5 shadow-2xl border border-white/15 flex flex-col gap-1 min-w-[130px]">
          <span className="text-[10px] font-bold text-[#7180A5] px-2 py-0.5 uppercase tracking-wider">
            Imagery
          </span>
          <button
            onClick={() => setActiveTile('satellite')}
            className={`flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all text-left ${
              activeTile === 'satellite'
                ? 'bg-sky-500/30 text-[#F5F7FF] border border-sky-400/40 shadow-xs'
                : 'text-[#AAB7D4] hover:bg-white/5 hover:text-[#F5F7FF] border border-transparent'
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
                ? 'bg-sky-500/30 text-[#F5F7FF] border border-sky-400/40 shadow-xs'
                : 'text-[#AAB7D4] hover:bg-white/5 hover:text-[#F5F7FF] border border-transparent'
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
                ? 'bg-sky-500/30 text-[#F5F7FF] border border-sky-400/40 shadow-xs'
                : 'text-[#AAB7D4] hover:bg-white/5 hover:text-[#F5F7FF] border border-transparent'
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
                ? 'bg-sky-500/30 text-[#F5F7FF] border border-sky-400/40 shadow-xs'
                : 'text-[#AAB7D4] hover:bg-white/5 hover:text-[#F5F7FF] border border-transparent'
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
            className="absolute bottom-4 left-4 z-10 p-4 rounded-2xl shadow-2xl border border-white/15 max-w-[260px] animate-in fade-in-50 slide-in-from-bottom-2 duration-200"
            style={{
              background: 'rgba(11, 22, 56, 0.92)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
            }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-sm font-extrabold uppercase tracking-wide text-[#F5F7FF]">
                {activeCardCity.city}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold border border-sky-400/30">
                {activeCardCity.state}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[rgba(14,27,68,0.65)] p-2 rounded-xl border border-white/10">
                <span className="text-[#AAB7D4] block text-[10px] font-medium">Rainfall</span>
                <span className="font-extrabold text-sky-400 text-sm">{activeCardCity.rainfall} mm</span>
              </div>
              <div className="bg-[rgba(14,27,68,0.65)] p-2 rounded-xl border border-white/10">
                <span className="text-[#AAB7D4] block text-[10px] font-medium">Temperature</span>
                <span className="font-extrabold text-amber-400 text-sm">{activeCardCity.temperature}°C</span>
              </div>
              <div className="bg-[rgba(14,27,68,0.65)] p-2 rounded-xl border border-white/10">
                <span className="text-[#AAB7D4] block text-[10px] font-medium">Wind Speed</span>
                <span className="font-extrabold text-purple-400 text-sm">{activeCardCity.wind} km/h</span>
              </div>
              <div className="bg-[rgba(14,27,68,0.65)] p-2 rounded-xl border border-white/10">
                <span className="text-[#AAB7D4] block text-[10px] font-medium">Confidence</span>
                <span className="font-extrabold text-emerald-400 text-sm">{activeCardCity.confidence}%</span>
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-white/10 text-[11px] text-[#AAB7D4] flex items-center justify-between">
              <span>Dominant Model:</span>
              <span className="font-bold text-sky-400">{activeCardCity.dominantModel}</span>
            </div>
            {activeCardCity.confidenceLabel && (
              <div className="mt-1 text-[10px] text-[#AAB7D4] flex items-center justify-between">
                <span>Rating:</span>
                <span className="font-semibold text-emerald-400">{activeCardCity.confidenceLabel}</span>
              </div>
            )}
            {activeCardCity.explanation && (
              <div className="mt-1.5 pt-1.5 border-t border-white/10 text-[10px] text-[#AAB7D4] italic leading-snug">
                &quot;{activeCardCity.explanation}&quot;
              </div>
            )}
          </div>
        );
      })()}

      {/* Model Dominance Overlay */}
      {layer === 'model_dominance' && (
        <div
          className="absolute top-4 left-4 z-10 rounded-2xl p-3.5 shadow-2xl border border-white/15 max-w-[220px]"
          style={{
            background: 'rgba(11, 22, 56, 0.92)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="text-[11px] font-bold text-[#F5F7FF] mb-2 flex items-center gap-1.5">
            <Sparkles size={13} className="text-sky-400" />
            REGIONAL DOMINANCE
          </div>
          <div className="space-y-1.5 text-[11px] text-[#AAB7D4]">
            {MOCK_REGION_DOMINANCE.slice(0, 4).map((r) => (
              <div key={r.region} className="flex justify-between items-center">
                <span className="text-[#7180A5]">{r.region}:</span>
                <span className="font-bold text-[#F5F7FF]">{r.dominantModel}</span>
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
