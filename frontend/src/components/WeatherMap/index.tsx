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
    <div className="w-full h-[520px] rounded-2xl bg-white/[0.04] backdrop-blur-md flex flex-col items-center justify-center text-[#A9B2C8] gap-3 border border-white/10">
      <div className="w-10 h-10 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
      <span className="text-xs font-medium tracking-wide text-[#F3F5FA]">Loading Interactive Weather Map…</span>
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
    <GlassCard padding="none" variant="default" className="overflow-hidden">
      {/* Controls Bar */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
        style={{ borderBottom: '1px solid rgba(220, 225, 255, 0.08)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <MapPin size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-bold tracking-widest uppercase"
                style={{ letterSpacing: '0.12em', color: 'var(--text-primary, #14213d)' }}
              >
                LIVE WEATHER MAP
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-400/30">
                45 Indian Stations
              </span>
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary, #566075)' }}>
              Real CartoDB Geographic Grid · Smooth Interactive Zoom
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Lead time selector with proper spacing */}
          <div className="flex items-center rounded-xl p-1 bg-black/[0.04] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 shadow-sm">
            {LEAD_TIMES.map((t) => (
              <button
                key={t}
                onClick={() => setLeadTime(t)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  leadTime === t
                    ? 'bg-sky-600/20 text-[#0b2a5b] dark:text-[#F3F5FA] border border-sky-600/30 dark:border-sky-400/35 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-[#A9B2C8] hover:text-[#0b2a5b] dark:hover:text-[#F3F5FA]'
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
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] border border-black/10 dark:border-white/10 shadow-sm transition-all"
              style={{ color: 'var(--text-primary, #14213d)' }}
              type="button"
            >
              <Layers size={14} className="text-sky-600 dark:text-sky-400" />
              <span>{LAYERS.find((l) => l.id === layer)?.label}</span>
              <ChevronDown size={13} className={`transition-transform ${layerMenuOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-secondary, #566075)' }} />
            </button>

            {layerMenuOpen && (
              <div
                className="absolute right-0 top-full mt-2 rounded-xl overflow-hidden z-30 py-1.5 shadow-2xl min-w-[170px]"
                style={{
                  background: 'var(--glass-bg, rgba(8, 13, 32, 0.94))',
                  backdropFilter: 'blur(26px)',
                  WebkitBackdropFilter: 'blur(26px)',
                  border: 'var(--glass-border, 1px solid rgba(220,225,255,0.16))',
                  boxShadow: 'var(--glass-shadow, 0 20px 40px rgba(0,0,0,0.7))',
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
                        ? 'bg-sky-500/25 text-sky-800 dark:text-sky-300 font-bold'
                        : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.08]'
                    }`}
                    style={{
                      color: layer === l.id ? undefined : 'var(--text-primary, #14213d)'
                    }}
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
              <div className="p-1 max-w-[220px] text-xs text-[#A9B2C8]">
                <span className="font-semibold text-[#F3F5FA]">Authentic Cartography</span>
                <p className="text-[#A9B2C8] mt-1">
                  Shows genuine Indian topography, borders, and coastlines with NO API key needed.
                </p>
              </div>
            }
          >
            <div className="p-2 rounded-xl text-[#747F9C] hover:text-[#A9B2C8] cursor-help">
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
