'use client';
import { useState, useEffect } from 'react';
import { ModelContribution } from '@/components/ModelContribution';
import { ModelComparison } from '@/components/ModelComparison';
import { ModelSkillPanel } from '@/components/ModelSkill';
import { GlassCard } from '@/components/ui/GlassCard';
import { getWeights, MOCK_REGION_DOMINANCE } from '@/lib/api';
import type { RegionModelDominance } from '@/types';
import { MapPin, BrainCircuit } from 'lucide-react';

export function ModelIntelligencePage() {
  const [dominance, setDominance] = useState<RegionModelDominance[]>(MOCK_REGION_DOMINANCE);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    let mounted = true;
    getWeights()
      .then((records) => {
        if (mounted) {
          if (records && records.length > 0) {
            // Compute real region dominance from weights records
            const regionMap: Record<string, string[]> = {
              'North India': ['delhi', 'kanpur', 'lucknow', 'chandigarh', 'dehradun', 'shimla', 'srinagar', 'amritsar', 'jaipur', 'jodhpur', 'kota', 'agra', 'varanasi', 'ghaziabad'],
              'Peninsular South': ['chennai', 'bengaluru', 'hyderabad', 'thiruvananthapuram', 'kochi', 'coimbatore', 'madurai', 'vijayawada', 'visakhapatnam'],
              'Western Arid': ['mumbai', 'pune', 'ahmedabad', 'surat', 'vadodara', 'nagpur', 'indore', 'bhopal', 'nashik', 'thane'],
              'Eastern Monsoon': ['kolkata', 'patna', 'ranchi', 'bhubaneswar', 'guwahati', 'imphal', 'shillong', 'agartala', 'raipur'],
            };
            const computedDominance: RegionModelDominance[] = Object.entries(regionMap).map(([region, cityList]) => {
              const regionWeights = records.filter(r => cityList.includes((r.city || '').toLowerCase()));
              const modelAverages: Record<string, { sum: number; count: number }> = {};
              for (const r of regionWeights) {
                const m = (r.model || '').toUpperCase();
                if (!modelAverages[m]) modelAverages[m] = { sum: 0, count: 0 };
                modelAverages[m].sum += r.weight;
                modelAverages[m].count += 1;
              }
              const sorted = Object.entries(modelAverages).map(([model, data]) => ({
                model,
                avgWeight: data.count > 0 ? data.sum / data.count : 0,
              })).sort((a, b) => b.avgWeight - a.avgWeight);
              const totalAvg = sorted.reduce((sum, s) => sum + s.avgWeight, 0) || 1;
              const top = sorted[0] || { model: 'ECMWF', avgWeight: 0.35 };
              const second = sorted[1] || { model: 'GFS', avgWeight: 0.25 };
              return {
                region,
                dominantModel: top.model,
                modelId: top.model.toLowerCase(),
                confidence: Math.round((top.avgWeight / totalAvg) * 100),
                isFallback: false,
              };
            });
            setDominance(computedDominance);
            setIsFallback(false);
          } else {
            setDominance(MOCK_REGION_DOMINANCE);
            setIsFallback(true);
          }
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsError(true);
          setDominance(MOCK_REGION_DOMINANCE);
          setIsFallback(true);
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
          <BrainCircuit size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Model Intelligence</h1>
          <p className="text-xs text-slate-400">Adaptive weighting logic, dominance mapping, and cross-model comparison</p>
        </div>
      </div>

      {isFallback && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium">
          <span>Displaying baseline model dominance (live weights unavailable from backend)</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ModelContribution />
        <ModelComparison />
      </div>

      {/* Regional dominance */}
      <GlassCard padding="md" variant="blue">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold tracking-widest text-slate-500" style={{ letterSpacing: '0.12em' }}>
            REGIONAL MODEL DOMINANCE
          </h2>
          {isFallback && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              Demo data (backend unavailable)
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {dominance.map((r) => (
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
