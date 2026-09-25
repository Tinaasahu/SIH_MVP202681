'use client';
import { ModelContribution } from '@/components/ModelContribution';
import { ModelComparison } from '@/components/ModelComparison';
import { ModelSkillPanel } from '@/components/ModelSkill';
import { GlassCard } from '@/components/ui/GlassCard';
import { MOCK_MODEL_WEIGHTS, MOCK_REGION_DOMINANCE } from '@/data/mockData';
import { MapPin, BrainCircuit } from 'lucide-react';

export function ModelIntelligencePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-600">
          <BrainCircuit size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Model Intelligence</h1>
          <p className="text-xs text-slate-400">Adaptive weighting logic, dominance mapping, and cross-model comparison</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ModelContribution />
        <ModelComparison />
      </div>

      {/* Regional dominance */}
      <GlassCard padding="md">
        <h2 className="text-xs font-semibold tracking-widest text-slate-500 mb-4" style={{ letterSpacing: '0.12em' }}>
          REGIONAL MODEL DOMINANCE
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MOCK_REGION_DOMINANCE.map((r) => (
            <div
              key={r.region}
              className="rounded-xl p-3.5"
              style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.12)' }}
            >
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <MapPin size={11} className="text-blue-500" />
                {r.region}
              </div>
              <div className="text-sm font-semibold text-slate-800">{r.dominantModel}</div>
              <div className="text-xs text-emerald-600 mt-1">{r.confidence}% confidence</div>
            </div>
          ))}
        </div>
      </GlassCard>

      <ModelSkillPanel />
    </div>
  );
}
