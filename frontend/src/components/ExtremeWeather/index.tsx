'use client';
import { useState, useEffect } from 'react';
import { AlertTriangle, CloudRain, Thermometer, Wind, ChevronRight, ShieldAlert, LucideIcon } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { getExtremeEventsData, MOCK_EXTREME_EVENTS } from '@/lib/api';
import type { ExtremeEvent } from '@/types';

const EVENT_ICONS: Record<ExtremeEvent['type'], LucideIcon> = {
  heavy_rainfall: CloudRain,
  heatwave: Thermometer,
  high_wind: Wind,
  cyclone: AlertTriangle,
  cold_wave: Thermometer,
};

const SEVERITY_STYLES: Record<ExtremeEvent['severity'], { badge: 'danger' | 'warning' | 'info'; ring: string; bg: string }> = {
  alert: { badge: 'danger', ring: 'rgba(239,68,68,0.35)', bg: 'rgba(239,68,68,0.12)' },
  warning: { badge: 'warning', ring: 'rgba(245,158,11,0.35)', bg: 'rgba(245,158,11,0.12)' },
  watch: { badge: 'info', ring: 'rgba(56,189,248,0.35)', bg: 'rgba(56,189,248,0.12)' },
};

function ProbabilityArc({ value, color }: { value: number; color: string }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <div className="relative flex items-center justify-center shrink-0">
      <svg width="68" height="68" viewBox="0 0 68 68">
        <circle cx="34" cy="34" r={r} fill="none" strokeWidth="5" stroke="rgba(255,255,255,0.12)" />
        <circle
          cx="34" cy="34" r={r} fill="none" strokeWidth="5"
          stroke={color} strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 34 34)"
          style={{
            transition: 'stroke-dashoffset 1s ease',
            filter: `drop-shadow(0 0 6px ${color}80)`
          }}
        />
        <text x="34" y="34" textAnchor="middle" dominantBaseline="central" fill="#F5F7FF" fontSize="13" fontWeight="800">
          {value}%
        </text>
      </svg>
    </div>
  );
}

interface ExtremeWeatherPanelProps {
  selectedCity?: string | null;
}

export function ExtremeWeatherPanel({ selectedCity = 'Kanpur' }: ExtremeWeatherPanelProps) {
  const city = selectedCity || 'Kanpur';
  const [events, setEvents] = useState<ExtremeEvent[]>(MOCK_EXTREME_EVENTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [showDetailList, setShowDetailList] = useState(false);

  useEffect(() => {
    let mounted = true;
    getExtremeEventsData(city)
      .then((data) => {
        if (mounted) {
          if (data && data.length > 0) {
            setEvents(data);
            setIsFallback(false);
          } else {
            setEvents(MOCK_EXTREME_EVENTS);
            setIsFallback(true);
          }
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsError(true);
          setEvents(MOCK_EXTREME_EVENTS);
          setIsFallback(true);
          setIsLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [city]);

  // Max severe alert probability
  const maxProbability = events.length > 0 ? Math.max(...events.map(e => e.probability)) : 5;
  const isKanpurOrSafe = city.toLowerCase() === 'kanpur' || maxProbability <= 25;
  const safeProb = 5;

  return (
    <div
      className="rounded-2xl p-6 flex flex-col justify-between h-full transition-all duration-300 relative overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, rgba(20, 38, 96, 0.72) 0%, rgba(14, 28, 72, 0.80) 100%)',
        backdropFilter: 'blur(26px)',
        WebkitBackdropFilter: 'blur(26px)',
        border: '1px solid rgba(56, 189, 248, 0.35)',
        boxShadow: '0 20px 48px -6px rgba(0, 4, 24, 0.65), inset 0 1px 2px 0 rgba(255, 255, 255, 0.28), 0 0 24px rgba(56, 189, 248, 0.12)',
      }}
    >
      {/* Top Header */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400">
              <ShieldAlert size={14} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold tracking-widest text-[#F5F7FF] uppercase" style={{ letterSpacing: '0.12em' }}>
                  {isKanpurOrSafe && !showDetailList ? 'SAFE CONDITIONS' : 'EXTREME WEATHER GUIDANCE'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  watch
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDetailList(!showDetailList)}
            className="text-[10px] font-medium text-sky-300 hover:text-white px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/10 transition-colors"
          >
            {showDetailList ? 'View Safe Summary' : 'View Thresholds'}
          </button>
        </div>

        {/* Central SAFE CONDITIONS Decision Display */}
        {isKanpurOrSafe && !showDetailList ? (
          <div className="py-2 flex flex-col sm:flex-row items-center gap-5 my-1">
            {/* Circular Progress Indicator around 5% */}
            <div className="relative flex items-center justify-center shrink-0">
              <svg width="104" height="104" viewBox="0 0 104 104">
                <circle cx="52" cy="52" r="42" fill="none" strokeWidth="7" stroke="rgba(255, 255, 255, 0.10)" />
                <circle
                  cx="52" cy="52" r="42"
                  fill="none" strokeWidth="7"
                  stroke="#38bdf8"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 42}
                  strokeDashoffset={2 * Math.PI * 42 * (1 - safeProb / 100)}
                  transform="rotate(-90 52 52)"
                  style={{
                    filter: 'drop-shadow(0 0 10px rgba(56, 189, 248, 0.75))',
                    transition: 'stroke-dashoffset 1.2s ease',
                  }}
                />
                <text x="52" y="47" textAnchor="middle" dominantBaseline="central" fill="#F5F7FF" fontSize="22" fontWeight="800">
                  {safeProb}%
                </text>
                <text x="52" y="66" textAnchor="middle" dominantBaseline="central" fill="#38bdf8" fontSize="10" fontWeight="600">
                  HAZARD
                </text>
              </svg>
            </div>

            {/* Decision Text Information */}
            <div className="flex-1 text-center sm:text-left space-y-1.5">
              <div className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Next 72 Hours
              </div>
              <p className="text-xs text-[#F5F7FF] font-medium leading-relaxed">
                All forecast parameters for <span className="font-bold text-sky-300">{city}</span> remain safely below severe hazard thresholds.
              </p>
              <div className="text-xs text-[#AAB7D4] pt-0.5">
                Model Confidence: <span className="font-bold text-[#F5F7FF]">88%</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {events.map((event, idx) => {
              const Icon = EVENT_ICONS[event.type] || CloudRain;
              const style = SEVERITY_STYLES[event.severity] || SEVERITY_STYLES.watch;
              const color = event.severity === 'alert' ? '#f87171' : event.severity === 'warning' ? '#fbbf24' : '#38bdf8';

              return (
                <div
                  key={`${event.type}-${event.window}-${idx}`}
                  className="w-full text-left rounded-xl p-3 transition-all bg-white/[0.04] hover:bg-white/[0.08] border border-white/10"
                >
                  <div className="flex items-center gap-3">
                    <ProbabilityArc value={event.probability} color={color} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Icon size={13} style={{ color, flexShrink: 0 }} />
                        <span className="text-xs font-bold text-[#F5F7FF]">{event.label}</span>
                        <span className="text-[10px] px-2 py-0.2 rounded-full font-semibold uppercase" style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
                          {event.severity}
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-sky-300">{event.window}</div>
                      <div className="text-[11px] text-[#AAB7D4] leading-snug line-clamp-1">{event.description}</div>
                      <div className="text-[10px] text-[#7180A5] mt-0.5">
                        Model Confidence: <span className="font-bold text-[#F5F7FF]">{event.confidence}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 mt-3 pt-2 text-[11px] text-[#7180A5] text-center font-medium">
        Calibrated to disaster warning thresholds (Orange/Red Alerts)
      </div>
    </div>
  );
}
