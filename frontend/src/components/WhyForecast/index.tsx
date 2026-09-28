'use client';
import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { getModelWeightsData, getConfidence, MOCK_MODEL_WEIGHTS } from '@/lib/api';
import type { ModelWeight, ConfidenceRecord } from '@/types';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface WhyForecastModalProps {
  open: boolean;
  onClose: () => void;
  selectedCity?: string | null;
}

export function WhyForecastModal({ open, onClose, selectedCity = 'Kanpur' }: WhyForecastModalProps) {
  const [weights, setWeights] = useState<ModelWeight[]>(MOCK_MODEL_WEIGHTS);
  const [conf, setConf] = useState<ConfidenceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    Promise.all([
      getModelWeightsData(selectedCity || 'Kanpur', 'temperature'),
      getConfidence(selectedCity || 'Kanpur', 1),
    ])
      .then(([weightsData, confData]) => {
        if (mounted) {
          if (weightsData && weightsData.length > 0 && weightsData !== MOCK_MODEL_WEIGHTS) {
            setWeights(weightsData);
            setIsFallback(false);
          } else {
            setWeights(MOCK_MODEL_WEIGHTS);
            setIsFallback(true);
          }
          if (confData && confData.length > 0) setConf(confData[0]);
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
  }, [open, selectedCity]);

  return (
    <Modal open={open} onClose={onClose} title="WHY THIS FORECAST?" size="md">
      <div className="space-y-5">
        {isFallback && (
          <div className="mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              Demo data (backend unavailable)
            </span>
          </div>
        )}
        {/* Context grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Dominant Model', value: conf?.dominant_model || 'ECMWF', highlight: true },
            { label: 'Lead time', value: '24 hours (Day 1)', highlight: false },
            { label: 'Historical regional skill', value: conf ? `${Math.round(conf.skill_score)}% (${conf.skill_score >= 80 ? 'High' : 'Moderate'})` : 'High', highlight: false },
            { label: 'Model agreement', value: conf ? `${Math.round(conf.agreement_score)}% (${conf.agreement_score >= 80 ? 'Strong' : 'Moderate'})` : 'Moderate', highlight: false },
          ].map(item => (
            <div
              key={item.label}
              className="rounded-xl p-3"
              style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.12)' }}
            >
              <div className="text-xs text-slate-400 mb-1">{item.label}</div>
              <div className={`text-sm font-semibold ${item.highlight ? 'text-blue-600' : 'text-slate-800'}`}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        {/* Adaptive weighting */}
        <div>
          <h3 className="text-xs font-semibold tracking-wider text-slate-500 mb-3" style={{ letterSpacing: '0.1em' }}>
            ADAPTIVE WEIGHTING
          </h3>
          <div className="space-y-3">
            {weights.map((w) => (
              <ProgressBar
                key={w.id}
                value={w.weight}
                color={w.color}
                label={w.name}
                height={7}
              />
            ))}
          </div>
        </div>

        {/* Reasoning */}
        <div
          className="rounded-xl p-4"
          style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.1)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-blue-600">Explainable Confidence Reasoning (ECE)</h3>
            {conf && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {conf.confidence}% · {conf.confidence_label}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            {conf?.explanation ||
              "Hybrid (Final) applies Random Forest residual correction on top of dynamically weighted NWP forecasts (ECMWF, GFS, ICON, GEM) based on lead-time historical skill."}
          </p>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-slate-400 leading-relaxed">
          This forecast is based on dynamic blending of 4 NWP models with Random Forest AI residual correction. It is intended for decision-support and should not replace official NCMRWF operational guidance.
        </p>
      </div>
    </Modal>
  );
}
