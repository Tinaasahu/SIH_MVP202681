'use client';
import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { getModelComparisonData, MOCK_MODEL_COMPARISON } from '@/lib/api';
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
  const [comparison, setComparison] = useState<ModelComparisonType[]>(MOCK_MODEL_COMPARISON);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let mounted = true;
    getModelComparisonData(selectedCity || 'Kanpur')
      .then((data) => {
        if (mounted && data && data.length > 0) {
          setComparison(data);
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

  const chartData = comparison.map(m => ({
    model: m.model,
    value: m[variable],
    isBlended: m.isBlended,
  }));

  return (
    <GlassCard padding="md" className="flex flex-col justify-between h-full">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
                <BarChart3 size={14} />
              </div>
              <span className="text-xs font-bold tracking-widest text-slate-700 uppercase" style={{ letterSpacing: '0.12em' }}>
                COMPARE MODELS
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">24h {config.label} ({config.unit}) Variance</p>
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

        {/* Bar Chart */}
        <div className="w-full h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.18)" />
              <XAxis dataKey="model" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(148,163,184,0.06)' }}
                contentStyle={{
                  background: 'rgba(255,255,255,0.96)',
                  border: '1px solid rgba(148,163,184,0.2)',
                  borderRadius: 12,
                  boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
                  fontSize: 12,
                }}
                formatter={(v: unknown) => [`${v} ${config.unit}`, config.label]}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.isBlended ? config.color : `${config.color}50`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Model Data Table */}
        <div className="mt-4 space-y-2">
          {chartData.map((d, i) => (
            <div
              key={i}
              className={`flex items-center justify-between py-2 px-3 rounded-xl transition-colors ${
                d.isBlended ? 'bg-blue-50/70 border border-blue-200/60' : 'bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                {d.isBlended && <Badge variant="info">Optimized Blend</Badge>}
                <span className={`text-xs ${d.isBlended ? 'font-bold text-slate-800' : 'text-slate-600'}`}>{d.model}</span>
              </div>
              <span
                className="text-xs font-bold"
                style={{ color: d.isBlended ? config.color : '#475569' }}
              >
                {d.value} {config.unit}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 mt-3 pt-2 text-[11px] text-slate-400 text-center font-medium">
        Blended output consensus reduces single-model outlier bias
      </div>
    </GlassCard>
  );
}
