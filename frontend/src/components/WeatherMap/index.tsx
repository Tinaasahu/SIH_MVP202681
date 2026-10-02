'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Layers, ChevronDown, Sparkles, MapPin, Info } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import { MapLayer, CityForecast } from '@/types';

// Dynamically import Leaflet with SSR disabled (Leaflet requires window)
const RealLeafletMap = dynamic(() => import('./RealLeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[520px] rounded-2xl bg-slate-100/60 animate-pulse flex flex-col items-center justify-center text-slate-400 gap-3 border border-slate-200/60">
      <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      <span className="text-xs font-medium tracking-wide">Starting AI weather engine… This may take up to 60 seconds.</span>
    </div>
  ),
});

const LAYERS: { id: MapLayer; label: string }[] = [
  { id: 'rainfall', label: 'Rainfall' },
  { id: 'temperature', label: 'Temperature' },
  { id: 'wind', label: 'Wind' },
  { id: 'extreme_risk', label: 'Extreme Risk' },
  { id: 'model_dominance', label: 'Model Dominance' },
  { id: 'confidence', label: 'Confidence' },
];

const LEAD_TIMES = ['24h', '48h', '72h'];

interface WeatherMapProps {
  selectedCity?: string | null;
  onSelectCity?: (city: CityForecast) => void;
}

export function WeatherMap({ selectedCity, onSelectCity }: WeatherMapProps) {
  const [layer, setLayer] = useState<MapLayer>('rainfall');
  const [leadTime, setLeadTime] = useState('24h');
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);

  return (
    <GlassCard padding="none" variant="blue" className="overflow-hidden">
      {/* Controls Bar */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.10)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400">
            <MapPin size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-widest text-[#F5F7FF] uppercase" style={{ letterSpacing: '0.12em' }}>
                LIVE WEATHER MAP
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-400/30">
                45 Indian Stations
              </span>
            </div>
            <p className="text-[11px] text-[#AAB7D4] mt-0.5">Real CartoDB Geographic Grid · Smooth Interactive Zoom</p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Lead time selector with proper spacing */}
          <div className="flex items-center rounded-xl p-1 bg-white/[0.06] border border-white/10 shadow-sm">
            {LEAD_TIMES.map((t) => (
              <button
                key={t}
                onClick={() => setLeadTime(t)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  leadTime === t
                    ? 'bg-sky-500/25 text-[#F5F7FF] border border-sky-400/35 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                    : 'text-[#AAB7D4] hover:text-[#F5F7FF]'
                }`}
                type="button"
              >
                {t}
              </button>
            ))}
          </div>

          {/* Layer Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setLayerMenuOpen(!layerMenuOpen)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#F5F7FF] bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 shadow-sm transition-all"
              type="button"
            >
              <Layers size={14} className="text-sky-400" />
              <span>{LAYERS.find((l) => l.id === layer)?.label}</span>
              <ChevronDown size={13} className={`text-[#AAB7D4] transition-transform ${layerMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {layerMenuOpen && (
              <div
                className="absolute right-0 top-full mt-2 rounded-xl overflow-hidden z-30 py-1.5 shadow-2xl border border-white/20 min-w-[170px]"
                style={{
                  background: 'rgba(11, 22, 56, 0.96)',
                  backdropFilter: 'blur(26px)',
                  WebkitBackdropFilter: 'blur(26px)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.7)',
                }}
              >
                {LAYERS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => {
                      setLayer(l.id);
                      setLayerMenuOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${
                      layer === l.id
                        ? 'bg-sky-500/25 text-sky-300 font-bold'
                        : 'text-[#AAB7D4] hover:bg-white/[0.08] hover:text-[#F5F7FF]'
                    }`}
                    type="button"
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Tooltip
            content={
              <div className="p-1 max-w-[220px] text-xs text-[#AAB7D4]">
                <span className="font-semibold text-[#F5F7FF]">Authentic Cartography</span>
                <p className="text-[#AAB7D4] mt-1">
                  Shows genuine Indian topography, borders, and coastlines with NO API key needed.
                </p>
              </div>
            }
          >
            <div className="p-2 rounded-xl text-[#7180A5] hover:text-[#AAB7D4] cursor-help">
              <Info size={15} />
            </div>
          </Tooltip>
        </div>
      </div>

      {/* Map Body */}
      <div className="p-3">
        <RealLeafletMap
          layer={layer}
          leadTime={leadTime}
          selectedCity={selectedCity}
          onSelectCity={onSelectCity}
        />
      </div>
    </GlassCard>
  );
}
