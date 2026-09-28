'use client';
import { useState, useEffect } from 'react';
import { ModelSkillPanel } from '@/components/ModelSkill';
import { PerformanceMatrix3D } from '@/components/PerformanceMatrix3D';
import { GlassCard } from '@/components/ui/GlassCard';
import { BarChart3 } from 'lucide-react';
import { getSkillMetricsData } from '@/lib/api';
import type { SkillMetric } from '@/types';

export function ModelPerformancePage() {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-600">
          <BarChart3 size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Model Performance &amp; Skill</h1>
          <p className="text-xs text-slate-400">Historical validation on test split across lead times and NWP methods</p>
        </div>
      </div>

      <ModelSkillPanel />

      {/* 3D Performance Matrix */}
      <PerformanceMatrix3D />

      {/* Historical skill summary */}
      <GlassCard padding="md" variant="green">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold tracking-widest text-slate-500 uppercase" style={{ letterSpacing: '0.12em' }}>
            SKILL SCORES OVER TIME (RMSE °C)
          </h2>
          {isError && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              Unavailable
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            Loading performance metrics from /api/performance...
          </div>
        ) : isError || metrics.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            Performance validation table unavailable. Unable to load metrics from /api/performance.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400">
                  <th className="text-left pb-2 font-medium">Period</th>
                  <th className="text-right pb-2 font-medium text-blue-600">Hybrid RF (Final)</th>
                  <th className="text-right pb-2 font-medium">Weighted Blend</th>
                  <th className="text-right pb-2 font-medium">ECMWF IFS</th>
                  <th className="text-right pb-2 font-medium">GFS</th>
                  <th className="text-right pb-2 font-medium">Ensemble</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {metrics.map((row) => (
                  <tr key={row.period} className="text-slate-700">
                    <td className="py-2.5 font-medium">{row.period}</td>
                    <td className="py-2.5 text-right font-bold text-blue-600">{row.ai.toFixed(4)}</td>
                    <td className="py-2.5 text-right text-slate-500">{row.blended.toFixed(4)}</td>
                    <td className="py-2.5 text-right text-slate-500">{row.nwpA.toFixed(4)}</td>
                    <td className="py-2.5 text-right text-slate-500">{row.nwpB.toFixed(4)}</td>
                    <td className="py-2.5 text-right text-slate-500">{row.ensemble.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-slate-400 mt-4">
          Computed on TEST split (61,560 rows) from outputs/performance_summary.csv. Lower RMSE indicates higher accuracy.
        </p>
      </GlassCard>
    </div>
  );
}
