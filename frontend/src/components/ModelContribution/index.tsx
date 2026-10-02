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
            <span className="text-xs font-bold tracking-widest text-[#F5F7FF] uppercase" style={{ letterSpacing: '0.12em' }}>
              MODEL CONTRIBUTION
            </span>
            {isFallback && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                Demo data (backend unavailable)
              </span>
            )}
            <Tooltip
              content={
                <div className="space-y-1 p-1 text-slate-200">
                  <p className="font-medium text-[#F5F7FF] text-xs">Weights adapt according to:</p>
                  {['Region', 'Season', 'Lead Time', 'Historical Skill', 'Weather Regime'].map(f => (
                    <div key={f} className="text-[#AAB7D4] text-xs flex items-center gap-1">
                      <span className="w-1 h-1 bg-sky-400 rounded-full" />{f}
                    </div>
                  ))}
                </div>
              }
            >
              <Info size={13} className="text-[#7180A5] cursor-help hover:text-[#AAB7D4]" />
            </Tooltip>
          </div>
          <p className="text-xs text-[#AAB7D4] mt-0.5">Adaptive blending weights</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30">
          <TrendingUp size={13} />
          Dynamic
        </div>
      </div>

      {/* Stacked bar */}
      <div className="h-2.5 rounded-full overflow-hidden flex mb-5 shadow-inner" role="img" aria-label="Model weight distribution">
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
                  style={{ background: w.color, boxShadow: `0 0 6px ${w.color}` }}
                />
                <span className="text-sm font-medium text-[#F5F7FF]">{w.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#7180A5]">
                  {w.rmse !== null && w.rmse !== undefined ? `RMSE ${w.rmse}` : 'RMSE —'}
                </span>
                <span className="text-sm font-bold" style={{ color: w.color }}>{w.weight}%</span>
              </div>
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: 'rgba(255, 255, 255, 0.08)' }}
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
        style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.20)' }}
      >
        <p className="text-xs text-[#AAB7D4]">
          <span className="font-bold text-sky-300">Hybrid (Final)</span> applies Random Forest residual correction on top of the 4 NWP consensus weights for localized precision.
        </p>
      </div>
    </GlassCard>
  );
}
