'use client';
import { useState, useEffect } from 'react';
import { AlertTriangle, CloudRain, Thermometer, Wind, ChevronRight, ShieldAlert } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { getExtremeEventsData, MOCK_EXTREME_EVENTS } from '@/lib/api';
import type { ExtremeEvent } from '@/types';

const EVENT_ICONS: Record<ExtremeEvent['type'], React.ElementType> = {
  heavy_rainfall: CloudRain,
  heatwave: Thermometer,
  high_wind: Wind,
  cyclone: AlertTriangle,
  cold_wave: Thermometer,
};

const SEVERITY_STYLES: Record<ExtremeEvent['severity'], { badge: 'danger' | 'warning' | 'info'; ring: string; bg: string }> = {
  alert: { badge: 'danger', ring: 'rgba(239,68,68,0.25)', bg: 'rgba(239,68,68,0.05)' },
  warning: { badge: 'warning', ring: 'rgba(245,158,11,0.25)', bg: 'rgba(245,158,11,0.05)' },
  watch: { badge: 'info', ring: 'rgba(59,130,246,0.2)', bg: 'rgba(59,130,246,0.04)' },
};

function ProbabilityArc({ value, color }: { value: number; color: string }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <div className="relative flex items-center justify-center shrink-0">
      <svg width="68" height="68" viewBox="0 0 68 68">
        <circle cx="34" cy="34" r={r} fill="none" strokeWidth="5" stroke="rgba(148,163,184,0.15)" />
        <circle
          cx="34" cy="34" r={r} fill="none" strokeWidth="5"
          stroke={color} strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 34 34)"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x="34" y="34" textAnchor="middle" dominantBaseline="central" fill={color} fontSize="13" fontWeight="800">
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
  const [events, setEvents] = useState<ExtremeEvent[]>(MOCK_EXTREME_EVENTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let mounted = true;
    getExtremeEventsData(selectedCity || 'Kanpur')
      .then((data) => {
        if (mounted && data && data.length > 0) {
          setEvents(data);
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
  }, [selectedCity]);

  return (
    <GlassCard padding="md" className="flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <ShieldAlert size={14} />
            </div>
            <div>
              <span className="text-xs font-bold tracking-widest text-slate-700 uppercase" style={{ letterSpacing: '0.12em' }}>
                EXTREME WEATHER GUIDANCE
              </span>
              <p className="text-xs text-slate-400 mt-0.5">Probabilistic Disaster Threshold Monitoring</p>
            </div>
          </div>
          <Badge variant="warning">Active Warnings</Badge>
        </div>

        <div className="space-y-3">
          {events.map((event) => {
            const Icon = EVENT_ICONS[event.type];
            const style = SEVERITY_STYLES[event.severity];
            const color = event.severity === 'alert' ? '#ef4444' : event.severity === 'warning' ? '#f59e0b' : '#2563eb';

            return (
              <div
                key={event.type}
                className="w-full text-left rounded-2xl p-3.5 transition-all hover:scale-[1.01] hover:shadow-xs"
                style={{ background: style.bg, border: `1px solid ${style.ring}` }}
              >
                <div className="flex items-center gap-3.5">
                  {/* Probability arc */}
                  <ProbabilityArc value={event.probability} color={color} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={14} style={{ color, shrink: 0 }} />
                      <span className="text-xs font-bold text-slate-800">{event.label}</span>
                      <Badge variant={style.badge}>{event.severity}</Badge>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-600 mb-1">{event.window}</div>
                    <div className="text-[11px] text-slate-500 leading-snug line-clamp-2">{event.description}</div>
                    <div className="text-[10px] text-slate-400 mt-1 font-medium">
                      Ensemble Agreement: <span className="font-bold text-slate-700">{event.confidence}%</span>
                    </div>
                  </div>

                  <ChevronRight size={14} className="text-slate-300 shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-100 mt-4 pt-2.5 text-[11px] text-slate-400 text-center font-medium">
        Calibrated to IMD disaster warning thresholds (Orange/Red Alerts)
      </div>
    </GlassCard>
  );
}
