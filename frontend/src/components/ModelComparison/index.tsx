'use client';
import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { getModelComparisonData } from '@/lib/api';
import type { ModelComparison as ModelComparisonType, Variable } from '@/types';
import { BarChart3 } from 'lucide-react';

const VARIABLE_CONFIG: Record<Variable, { label: string; unit: string; color: string }> = {
  rainfall: { label: 'Rainfall', unit: 'mm', color: '#0284c7' },
  temperature: { label: 'Temperature', unit: '°C', color: '#f97316' },
  wind: { label: 'Wind', unit: 'km/h', color: '#8b5cf6' },
};

interface ModelComparisonProps {
  selectedCity?: string | null;
}

export function ModelComparison({ selectedCity = 'Kanpur' }: ModelComparisonProps) {
  const [variable, setVariable] = useState<Variable>('rainfall');
  const [comparison, setComparison] = useState<ModelComparisonType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setIsError(false);
    getModelComparisonData(selectedCity || 'Kanpur')
      .then((data) => {
        if (mounted) {
          if (data && data.length > 0) {
            setComparison(data);
          } else {
            setComparison([]);
          }
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsError(true);
          setComparison([]);
          setIsLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [selectedCity]);

  if (!isLoading && (isError || comparison.length === 0)) {
    return (
      <GlassCard padding="md" variant="yellow" className="flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
              <BarChart3 size={14} />
            </div>
            <span className="text-xs font-bold tracking-widest text-slate-700 uppercase" style={{ letterSpacing: '0.12em' }}>
              COMPARE MODELS
            </span>
          </div>
          <div className="py-16 text-center text-slate-400 text-xs font-semibold bg-slate-50/60 rounded-xl border border-slate-100 flex flex-col items-center justify-center gap-2">
            <span>Model comparison data unavailable</span>
            <span className="text-[11px] text-slate-400 font-normal">Real NWP multi-model forecast could not be loaded for {selectedCity || 'this city'}</span>
          </div>
        </div>
      </GlassCard>
    );
  }

  const config = VARIABLE_CONFIG[variable];

  const chartData = comparison.map(m => ({
    model: m.model,
    value: m[variable],
    isBlended: m.isBlended,
  }));

  return (
    <GlassCard padding="md" variant="default" className="flex flex-col justify-between h-full">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
                <BarChart3 size={14} />
              </div>
              <span
                className="text-xs font-bold tracking-widest uppercase"
                style={{ letterSpacing: '0.12em', color: 'var(--text-primary, #14213d)' }}
              >
                MODEL BLEND
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary, #566075)' }}>
              24h {config.label} ({config.unit}) Consensus &amp; Variance
            </p>
          </div>

          {/* Separated Pill Buttons with Breathing Room */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 shadow-sm">
            {(Object.keys(VARIABLE_CONFIG) as Variable[]).map((v) => (
              <button
                key={v}
                onClick={() => setVariable(v)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  variable === v
                    ? 'bg-sky-600/20 text-[#0b2a5b] dark:text-[#F3F5FA] border border-sky-600/30 dark:border-sky-400/35 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-[#A9B2C8] hover:text-[#0b2a5b] dark:hover:text-[#F3F5FA] hover:bg-black/5 dark:hover:bg-white/[0.08]'
                }`}
                type="button"
              >
                {VARIABLE_CONFIG[v].label}
              </button>
            ))}
          </div>
        </div>

        {/* Bar Chart */}
        <div className="w-full h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--card-sub-border, rgba(255,255,255,0.08))" />
              <XAxis dataKey="model" tick={{ fontSize: 10, fill: 'var(--text-secondary, #566075)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary, #566075)' }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                contentStyle={{
                  background: 'var(--glass-bg, rgba(8, 13, 32, 0.92))',
                  border: 'var(--glass-border, 1px solid rgba(220, 225, 255, 0.16))',
                  borderRadius: 12,
                  boxShadow: '0 12px 30px rgba(0,0,0,0.2)',
                  color: 'var(--text-primary, #14213d)',
                  fontSize: 12,
                }}
                formatter={(v: unknown) => [`${v} ${config.unit}`, config.label]}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.isBlended ? '#0284c7' : 'rgba(169, 178, 200, 0.45)'}
                    style={d.isBlended ? { filter: 'drop-shadow(0 0 6px rgba(2, 132, 199, 0.45))' } : undefined}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Model Data Table - Compact Rows */}
        <div className="mt-4 space-y-2">
          {chartData.map((d, i) => (
            <div
              key={i}
              className={`flex items-center justify-between py-2 px-3 rounded-xl transition-all ${
                d.isBlended
                  ? 'bg-sky-500/15 border border-sky-400/40 shadow-xs'
                  : 'bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] border border-black/10 dark:border-white/[0.08]'
              }`}
            >
              <div className="flex items-center gap-2">
                {d.isBlended && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/25 text-sky-800 dark:text-sky-300 border border-sky-400/35">
                    Optimized Blend
                  </span>
                )}
                <span
                  className={`text-xs ${d.isBlended ? 'font-bold' : 'font-medium'}`}
                  style={{ color: d.isBlended ? 'var(--navy2, #0284c7)' : 'var(--text-primary, #14213d)' }}
                >
                  {d.model}
                </span>
              </div>
              <span
                className="text-xs font-bold"
                style={{ color: d.isBlended ? '#0284c7' : 'var(--text-primary, #14213d)' }}
              >
                {d.value} {config.unit}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        className="border-t border-black/10 dark:border-white/[0.08] mt-3 pt-2 text-[11px] text-center font-medium"
        style={{ color: 'var(--text-muted, #747F9C)' }}
      >
        Blended output consensus reduces single-model outlier bias
      </div>
    </GlassCard>
  );
}
