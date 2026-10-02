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

const VARIABLE_CONFIG: Record<Variable, {
  label: string;
  unit: string;
  color: string;
  key: string;
  uncertaintyHigh?: string;
  uncertaintyLow?: string;
  domain?: [number | string | ((val: number) => number), number | string | ((val: number) => number)];
}> = {
  rainfall: {
    label: 'Rainfall',
    unit: 'mm',
    color: '#0284c7',
    key: 'rainfall',
    uncertaintyHigh: 'rainfallUncertaintyHigh',
    uncertaintyLow: 'rainfallUncertaintyLow',
    domain: [0, 'auto'],
  },
  temperature: {
    label: 'Temperature',
    unit: '°C',
    color: '#f97316',
    key: 'temperature',
    uncertaintyHigh: 'temperatureUncertaintyHigh',
    uncertaintyLow: 'temperatureUncertaintyLow',
    domain: [(min: number) => Math.max(0, Math.floor(min - 3)), (max: number) => Math.ceil(max + 3)],
  },
  wind: {
    label: 'Wind Speed',
    unit: 'km/h',
    color: '#8b5cf6',
    key: 'wind',
    uncertaintyHigh: 'windUncertaintyHigh',
    uncertaintyLow: 'windUncertaintyLow',
    domain: [0, 'auto'],
  },
};

const CustomTooltip = ({
  active,
  payload,
  label,
  dataList,
  variable,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
  dataList?: TimelinePoint[];
  variable?: Variable;
}) => {
  if (!active || !payload?.length) return null;
  const list = dataList || MOCK_TIMELINE;
  const data = list.find(t => t.time === label);
  const cfg = variable ? VARIABLE_CONFIG[variable] : VARIABLE_CONFIG.rainfall;
  const val = data ? (data[cfg.key as keyof typeof data] as number) : payload[0].value;

  let high: number | undefined;
  let low: number | undefined;
  if (data && cfg.uncertaintyHigh && cfg.uncertaintyLow) {
    high = data[cfg.uncertaintyHigh as keyof typeof data] as number;
    low = data[cfg.uncertaintyLow as keyof typeof data] as number;
  }
  const hasSpread = high !== undefined && low !== undefined && high > low;

  return (
    <div
      className="rounded-xl px-4 py-3 shadow-2xl"
      style={{
        background: 'rgba(8, 13, 32, 0.92)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(220, 225, 255, 0.16)',
        minWidth: 160,
      }}
    >
      <div className="text-[11px] font-semibold text-[#A9B2C8] mb-1.5 flex items-center justify-between">
        <span className="font-bold text-[#F3F5FA]">{label}</span>
        {data?.label && <span className="text-[#747F9C] font-normal">({data.label} IST)</span>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-bold text-[#F3F5FA]">
          {typeof val === 'number' ? val.toFixed(1) : val}
        </span>
        <span className="text-xs font-semibold text-[#A9B2C8]">{cfg.unit}</span>
      </div>
      {hasSpread ? (
        <div className="text-[10px] text-[#A9B2C8] font-medium mt-1">
          Uncertainty: {low?.toFixed(1)} – {high?.toFixed(1)} {cfg.unit}
        </div>
      ) : (
        <div className="text-[10px] text-[#747F9C] font-medium mt-1">
          Consensus: High confidence
        </div>
      )}
      {data && (
        <div className="text-[11px] text-emerald-400 font-semibold mt-1">
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
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    let mounted = true;
    getTimelineData(selectedCity || 'Kanpur')
      .then((data) => {
        if (mounted) {
          if (data && data.length > 0 && data !== MOCK_TIMELINE) {
            setTimeline(data);
            setIsFallback(false);
          } else {
            setTimeline(MOCK_TIMELINE);
            setIsFallback(true);
          }
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsError(true);
          setTimeline(MOCK_TIMELINE);
          setIsFallback(true);
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
    <GlassCard padding="md" variant="default">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-sky-500/15 border border-sky-400/20 flex items-center justify-center text-sky-400">
              <Calendar size={14} />
            </div>
            <span className="text-xs font-bold tracking-widest text-[#F3F5FA] uppercase" style={{ letterSpacing: '0.12em' }}>
              FORECAST TIMELINE
            </span>
            {isFallback && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Demo data (backend unavailable)
              </span>
            )}
          </div>
          <p className="text-xs text-[#A9B2C8] mt-1">72-Hour Continuous Outlook with Adaptive AI Uncertainty Bands</p>
        </div>

        {/* Separated Pill Buttons with Dark Glass Styling */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.06] border border-white/10 shadow-xs backdrop-blur-md">
          {(Object.keys(VARIABLE_CONFIG) as Variable[]).map((v) => (
            <button
              key={v}
              onClick={() => setVariable(v)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                variable === v
                  ? 'bg-sky-500/25 text-[#F3F5FA] border border-sky-400/40 shadow-xs'
                  : 'text-[#A9B2C8] hover:text-[#F3F5FA] hover:bg-white/5 border border-transparent'
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
                <stop offset="5%" stopColor={config.color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={config.color} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="uncertainty-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={config.color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={config.color} stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#A9B2C8' }} axisLine={false} tickLine={false} />
            <YAxis
              domain={config.domain as any}
              tick={{ fontSize: 11, fill: '#A9B2C8' }}
              axisLine={false}
              tickLine={false}
              unit={config.unit === 'mm' ? ' mm' : ` ${config.unit}`}
            />
            <ReTooltip content={<CustomTooltip dataList={timeline} variable={variable} />} />
            <ReferenceLine x="NOW" stroke={config.color} strokeDasharray="3 3" opacity={0.7} />
            {config.uncertaintyHigh && (
              <Area
                type="monotone"
                dataKey="high"
                stroke="none"
                fill="url(#uncertainty-grad)"
                fillOpacity={1}
                tooltipType="none"
              />
            )}
            {config.uncertaintyLow && (
              <Area
                type="monotone"
                dataKey="low"
                stroke="none"
                fill="rgba(8, 13, 32, 0.75)"
                fillOpacity={1}
                tooltipType="none"
              />
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke={config.color}
              strokeWidth={3}
              fill={`url(#grad-${variable})`}
              dot={{ r: 4, fill: config.color, strokeWidth: 2, stroke: '#F3F5FA' }}
              activeDot={{ r: 6, fill: config.color, stroke: '#F3F5FA', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-white/10">
        <div className="flex items-center gap-5 text-xs text-[#A9B2C8]">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-1 rounded-full" style={{ background: config.color }} />
            <span>Optimal Blended Curve</span>
          </div>
          {config.uncertaintyHigh && (
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-2.5 rounded opacity-50" style={{ background: config.color }} />
              <span>Multi-Model Uncertainty Spread</span>
            </div>
          )}
        </div>
        <div className="text-xs text-[#747F9C] font-medium">
          Lead Range: 0h – 72h
        </div>
      </div>
    </GlassCard>
  );
}
