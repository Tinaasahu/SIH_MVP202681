'use client';
import { useState, useEffect } from 'react';
import { TrendingUp, Info } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Tooltip } from '@/components/ui/Tooltip';
import { getModelWeightsData, MOCK_MODEL_WEIGHTS } from '@/lib/api';
import type { ModelWeight } from '@/types';

interface ModelContributionProps {
  selectedCity?: string | null;
}

export function ModelContribution({ selectedCity = 'Kanpur' }: ModelContributionProps) {
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);
  const [weights, setWeights] = useState<ModelWeight[]>(MOCK_MODEL_WEIGHTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    let mounted = true;
    getModelWeightsData(selectedCity || 'Kanpur', 'temperature')
      .then((data) => {
        if (mounted) {
          if (data && data.length > 0 && data !== MOCK_MODEL_WEIGHTS) {
            setWeights(data);
            setIsFallback(false);
          } else {
            setWeights(MOCK_MODEL_WEIGHTS);
            setIsFallback(true);
          }
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsError(true);
          setWeights(MOCK_MODEL_WEIGHTS);
          setIsFallback(true);
          setIsLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [selectedCity]);

  const total = weights.reduce((s, w) => s + w.weight, 0);

  return (
    <GlassCard padding="md" variant="blue">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-widest text-slate-500" style={{ letterSpacing: '0.12em' }}>
              MODEL CONTRIBUTION
            </span>
            {isFallback && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                Demo data (backend unavailable)
              </span>
            )}
            <Tooltip
              content={
                <div className="space-y-1 p-1">
                  <p className="font-medium text-slate-700 text-xs">Weights adapt according to:</p>
                  {['Region', 'Season', 'Lead Time', 'Historical Skill', 'Weather Regime'].map(f => (
                    <div key={f} className="text-slate-500 text-xs flex items-center gap-1">
                      <span className="w-1 h-1 bg-blue-400 rounded-full" />{f}
                    </div>
                  ))}
                </div>
              }
            >
              <Info size={13} className="text-slate-300 cursor-help" />
            </Tooltip>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Adaptive blending weights</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
          <TrendingUp size={13} />
          Dynamic
        </div>
      </div>

      {/* Stacked bar */}
      <div className="h-2.5 rounded-full overflow-hidden flex mb-5" role="img" aria-label="Model weight distribution">
        {weights.map((w) => (
          <div
            key={w.id}
            style={{
              width: `${(w.weight / total) * 100}%`,
              background: w.color,
              transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
              opacity: hoveredModel && hoveredModel !== w.id ? 0.35 : 1,
            }}
          />
        ))}
      </div>

      {/* Individual model rows */}
      <div className="space-y-3">
        {weights.map((w) => (
          <div
            key={w.id}
            className="group"
            onMouseEnter={() => setHoveredModel(w.id)}
            onMouseLeave={() => setHoveredModel(null)}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: w.color }}
                />
                <span className="text-sm text-slate-700">{w.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">
                  {w.rmse !== null && w.rmse !== undefined ? `RMSE ${w.rmse}` : 'RMSE —'}
                </span>
                <span className="text-sm font-semibold" style={{ color: w.color }}>{w.weight}%</span>
              </div>
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: 'rgba(148,163,184,0.12)' }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${w.weight}%`,
                  background: w.color,
                  opacity: hoveredModel && hoveredModel !== w.id ? 0.35 : 1,
                  transition: 'all 0.5s cubic-bezier(0.16,1,0.3,1)',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* NCMRWF note */}
      <div
        className="mt-5 rounded-xl px-3.5 py-3"
        style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.1)' }}
      >
        <p className="text-xs text-slate-500">
          <span className="font-medium text-blue-600">Hybrid (Final)</span> applies Random Forest residual correction on top of the 4 NWP consensus weights for localized precision.
        </p>
      </div>
    </GlassCard>
  );
}
