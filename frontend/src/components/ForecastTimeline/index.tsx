'use client';
import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import { GlassCard } from '@/components/ui/GlassCard';
import { getTimelineData, MOCK_TIMELINE } from '@/lib/api';
import type { TimelinePoint, Variable } from '@/types';
import { Calendar, TrendingUp } from 'lucide-react';
import { useEffect } from 'react';

const VARIABLE_CONFIG: Record<Variable, { label: string; unit: string; color: string; key: string; uncertaintyHigh?: string; uncertaintyLow?: string }> = {
  rainfall: { label: 'Rainfall', unit: 'mm', color: '#0284c7', key: 'rainfall', uncertaintyHigh: 'rainfallUncertaintyHigh', uncertaintyLow: 'rainfallUncertaintyLow' },
  temperature: { label: 'Temperature', unit: '°C', color: '#f97316', key: 'temperature' },
  wind: { label: 'Wind Speed', unit: 'km/h', color: '#8b5cf6', key: 'wind' },
};

const CustomTooltip = ({ active, payload, label, dataList }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string; dataList?: TimelinePoint[] }) => {
  if (!active || !payload?.length) return null;
  const list = dataList || MOCK_TIMELINE;
  const data = list.find(t => t.time === label);
  return (
    <div
      className="rounded-xl px-4 py-3 shadow-xl"
      style={{
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(148,163,184,0.2)',
        minWidth: 150,
      }}
    >
      <div className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center justify-between">
        <span>{label}</span>
        {data?.label && <span className="text-slate-400 font-normal">({data.label} IST)</span>}
      </div>
      {payload.map((p, i) => (
        <div key={i} className="text-base font-bold text-slate-800">
          {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
        </div>
      ))}
      {data && (
        <div className="text-[11px] text-emerald-600 font-medium mt-1">
          Confidence: {data.confidence}%
        </div>
      )}
    </div>
  );
};

interface ForecastTimelineProps {
  selectedCity?: string | null;
}

export function ForecastTimeline({ selectedCity = 'Kanpur' }: ForecastTimelineProps) {
  const [variable, setVariable] = useState<Variable>('rainfall');
  const [timeline, setTimeline] = useState<TimelinePoint[]>(MOCK_TIMELINE);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let mounted = true;
    getTimelineData(selectedCity || 'Kanpur')
      .then((data) => {
        if (mounted && data && data.length > 0) {
          setTimeline(data);
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

  const config = VARIABLE_CONFIG[variable];

  const chartData = timeline.map(t => ({
    time: t.time,
    label: t.label,
    value: t[config.key as keyof typeof t] as number,
    high: config.uncertaintyHigh ? t[config.uncertaintyHigh as keyof typeof t] as number : undefined,
    low: config.uncertaintyLow ? t[config.uncertaintyLow as keyof typeof t] as number : undefined,
    confidence: t.confidence,
  }));

  return (
    <GlassCard padding="md">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
              <Calendar size={14} />
            </div>
            <span className="text-xs font-bold tracking-widest text-slate-700 uppercase" style={{ letterSpacing: '0.12em' }}>
              FORECAST TIMELINE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">72-Hour Continuous Outlook with Adaptive AI Uncertainty Bands</p>
        </div>

        {/* Separated Pill Buttons with Breathing Room */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/80 border border-slate-200/80 shadow-2xs">
          {(Object.keys(VARIABLE_CONFIG) as Variable[]).map((v) => (
            <button
              key={v}
              onClick={() => setVariable(v)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                variable === v
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
              type="button"
            >
              {VARIABLE_CONFIG[v].label}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id={`grad-${variable}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={config.color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={config.color} stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="uncertainty-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={config.color} stopOpacity={0.12} />
                <stop offset="95%" stopColor={config.color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.18)" />
            <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} unit={config.unit === 'mm' ? ' mm' : config.unit} />
            <ReTooltip content={<CustomTooltip />} />
            <ReferenceLine x="NOW" stroke={config.color} strokeDasharray="3 3" opacity={0.6} />
            {config.uncertaintyHigh && (
              <Area
                type="monotone"
                dataKey="high"
                stroke="none"
                fill="url(#uncertainty-grad)"
                fillOpacity={1}
              />
            )}
            {config.uncertaintyLow && (
              <Area
                type="monotone"
                dataKey="low"
                stroke="none"
                fill="white"
                fillOpacity={1}
              />
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke={config.color}
              strokeWidth={3}
              fill={`url(#grad-${variable})`}
              dot={{ r: 4, fill: config.color, strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, fill: config.color, stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-5 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-1 rounded-full" style={{ background: config.color }} />
            <span>Optimal Blended Curve</span>
          </div>
          {config.uncertaintyHigh && (
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-2.5 rounded opacity-40" style={{ background: config.color }} />
              <span>Multi-Model Uncertainty Spread</span>
            </div>
          )}
        </div>
        <div className="text-xs text-slate-400 font-medium">
          Lead Range: 0h – 72h
        </div>
      </div>
    </GlassCard>
  );
}
