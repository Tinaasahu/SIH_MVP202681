'use client';
import { useState, useEffect } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Tooltip } from '@/components/ui/Tooltip';
import { Info, Award, BarChart2 } from 'lucide-react';
import { getSkillMetricsData } from '@/lib/api';
import type { SkillMetric } from '@/types';

type Period = 'Lead 1 (24h)' | 'Lead 2 (48h)' | 'Lead 3 (72h)';
const PERIOD_TABS: Period[] = ['Lead 1 (24h)', 'Lead 2 (48h)', 'Lead 3 (72h)'];

const MODELS = [
  { key: 'ai', label: 'Hybrid RF (Final)', color: '#0ea5e9' },
  { key: 'blended', label: 'Weighted Blend', color: '#2563eb' },
  { key: 'nwpA', label: 'ECMWF IFS', color: '#6366f1' },
  { key: 'nwpB', label: 'GFS Seamless', color: '#8b5cf6' },
  { key: 'ensemble', label: 'Ensemble Mean', color: '#06b6d4' },
] as const;

export function ModelSkillPanel() {
  const [period, setPeriod] = useState<Period>('Lead 1 (24h)');
  const [metrics, setMetrics] = useState<SkillMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let mounted = true;
    getSkillMetricsData()
      .then((data) => {
        if (mounted) {
          if (data && data.length > 0) {
            setMetrics(data);
            setIsError(false);
          } else {
            setIsError(true);
          }
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

  if (isLoading) {
    return (
      <GlassCard padding="md" variant="green">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
            <BarChart2 size={14} />
          </div>
          <span className="text-xs font-bold tracking-widest text-slate-700 uppercase" style={{ letterSpacing: '0.12em' }}>
            MODEL SKILL SCORE
          </span>
        </div>
        <div className="py-8 text-center text-slate-400 text-xs">
          Loading performance skill metrics...
        </div>
      </GlassCard>
    );
  }

  if (isError || metrics.length === 0) {
    return (
      <GlassCard padding="md" variant="green">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
              <BarChart2 size={14} />
            </div>
            <span className="text-xs font-bold tracking-widest text-slate-700 uppercase" style={{ letterSpacing: '0.12em' }}>
              MODEL SKILL SCORE
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              Unavailable
            </span>
          </div>
        </div>
        <div className="py-8 text-center text-slate-500 text-xs">
          Performance metrics unavailable. Could not fetch skill data from /api/performance.
        </div>
      </GlassCard>
    );
  }

  const data = metrics.find(m => m.period.toLowerCase().includes(period.toLowerCase())) || metrics[0];

  const tableRows = MODELS.map(m => ({
    ...m,
    rmse: (data[m.key as keyof typeof data] as number) || 0,
  })).sort((a, b) => a.rmse - b.rmse);

  const hybridRmse = data.ai || 0;
  const ecmwfRmse = data.nwpA || 0;
  const improvementPct = ecmwfRmse > 0 ? (((ecmwfRmse - hybridRmse) / ecmwfRmse) * 100).toFixed(1) : '0.0';

  return (
    <GlassCard padding="md" variant="green">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
            <BarChart2 size={14} />
          </div>
          <span className="text-xs font-bold tracking-widest text-slate-700 uppercase" style={{ letterSpacing: '0.12em' }}>
            MODEL SKILL SCORE
          </span>
          <Tooltip content={<div className="p-1.5 text-xs text-slate-700 max-w-[210px]">RMSE (Root Mean Square Error) against TEST ground truth split. Lower is better.</div>}>
            <Info size={13} className="text-slate-400 cursor-help" />
          </Tooltip>
        </div>

        {/* Separated Pill Buttons */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/80 border border-slate-200/80 shadow-2xs">
          {PERIOD_TABS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                period === p
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
              }`}
              type="button"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {tableRows.map((m, i) => (
          <div
            key={m.key}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-all ${
              i === 0
                ? 'bg-blue-50/80 border border-blue-200/70 shadow-xs'
                : 'bg-white/40 hover:bg-white/70 border border-slate-100'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
              style={{ background: m.color }}
            />
            <span className={`text-xs flex-1 ${i === 0 ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
              {m.label}
            </span>
            {i === 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full border border-emerald-200">
                <Award size={11} /> Top Skill
              </span>
            )}
            <span className="text-xs font-bold text-slate-800">{m.rmse.toFixed(3)}</span>
            <span className="text-[11px] text-slate-400 font-medium w-16 text-right">RMSE °C</span>
          </div>
        ))}
      </div>

      <div
        className="mt-4 rounded-xl px-3.5 py-3"
        style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)' }}
      >
        <p className="text-xs text-slate-700 leading-relaxed font-medium">
          Hybrid RF reduces error by <span className="font-bold text-blue-700">{improvementPct}%</span> compared to ECMWF IFS for {period}.
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          Hybrid vs raw ECMWF (no bias correction), 19-day held-out test, ERA5 reference
        </p>
      </div>
    </GlassCard>
  );
}
