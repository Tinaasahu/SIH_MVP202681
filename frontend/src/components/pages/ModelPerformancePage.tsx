'use client';
import { ModelSkillPanel } from '@/components/ModelSkill';
import { GlassCard } from '@/components/ui/GlassCard';
import { BarChart3, TrendingDown } from 'lucide-react';
import { MOCK_SKILL_METRICS } from '@/data/mockData';

export function ModelPerformancePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-600">
          <BarChart3 size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Model Performance &amp; Skill</h1>
          <p className="text-xs text-slate-400">Historical validation against ERA5 reanalysis across lead times and regions</p>
        </div>
      </div>

      <ModelSkillPanel />

      {/* Historical skill summary */}
      <GlassCard padding="md">
        <h2 className="text-xs font-semibold tracking-widest text-slate-500 mb-4" style={{ letterSpacing: '0.12em' }}>
          SKILL SCORES OVER TIME (RMSE mm)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-400">
                <th className="text-left pb-2 font-medium">Period</th>
                <th className="text-right pb-2 font-medium text-blue-600">Blended</th>
                <th className="text-right pb-2 font-medium">AI Model</th>
                <th className="text-right pb-2 font-medium">ECMWF IFS</th>
                <th className="text-right pb-2 font-medium">GFS</th>
                <th className="text-right pb-2 font-medium">Ensemble</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {MOCK_SKILL_METRICS.map((row) => (
                <tr key={row.period} className="text-slate-700">
                  <td className="py-2.5 font-medium">{row.period}</td>
                  <td className="py-2.5 text-right font-bold text-blue-600">{row.blended}</td>
                  <td className="py-2.5 text-right text-slate-500">{row.ai}</td>
                  <td className="py-2.5 text-right text-slate-500">{row.nwpA}</td>
                  <td className="py-2.5 text-right text-slate-500">{row.nwpB}</td>
                  <td className="py-2.5 text-right text-slate-500">{row.ensemble}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400 mt-4">
          Skill scores evaluated on 61-day reanalysis dataset (July–Sept 2026). Lower RMSE indicates higher accuracy.
        </p>
      </GlassCard>
    </div>
  );
}
