'use client';
import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ENGINE_STATUS, MOCK_MODEL_WEIGHTS } from '@/data/mockData';

interface BlendingEngineModalProps {
  open: boolean;
  onClose: () => void;
}

const PIPELINE = [
  { label: 'AI Model', color: '#3b82f6' },
  { label: 'ECMWF IFS', color: '#0ea5e9' },
  { label: 'GFS Seamless', color: '#6366f1' },
  { label: 'Observations', color: '#10b981' },
];

export function BlendingEngineModal({ open, onClose }: BlendingEngineModalProps) {
  const [animStep, setAnimStep] = useState(0);

  useEffect(() => {
    if (!open) { setAnimStep(0); return; }
    const interval = setInterval(() => {
      setAnimStep(s => (s + 1) % (PIPELINE.length + 2));
    }, 400);
    return () => clearInterval(interval);
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="BLENDING ENGINE" size="md">
      <div className="space-y-5">
        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Models analyzed', value: ENGINE_STATUS.modelsAnalyzed },
            { label: 'Regions evaluated', value: ENGINE_STATUS.regionsEvaluated },
            { label: 'Lead time', value: ENGINE_STATUS.leadTime },
            { label: 'Current regime', value: ENGINE_STATUS.currentRegime },
            { label: 'Adaptive weighting', value: 'Enabled' },
            { label: 'Confidence', value: `${ENGINE_STATUS.confidence}%` },
          ].map(s => (
            <div key={s.label}
              className="rounded-xl p-3"
              style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.12)' }}
            >
              <div className="text-xs text-slate-400 mb-1">{s.label}</div>
              <div className="text-sm font-semibold text-slate-800">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Animated pipeline */}
        <div
          className="rounded-xl p-5"
          style={{ background: 'rgba(148,163,184,0.04)', border: '1px solid rgba(148,163,184,0.1)' }}
        >
          <h3 className="text-xs font-semibold tracking-wider text-slate-400 mb-4" style={{ letterSpacing: '0.1em' }}>
            BLENDING PIPELINE
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {PIPELINE.map((p, i) => (
              <div key={p.label} className="flex items-center gap-2">
                <div
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300"
                  style={{
                    background: animStep >= i ? `${p.color}18` : 'rgba(148,163,184,0.08)',
                    border: `1px solid ${animStep >= i ? `${p.color}40` : 'rgba(148,163,184,0.15)'}`,
                    color: animStep >= i ? p.color : '#94a3b8',
                  }}
                >
                  {p.label}
                </div>
                {i < PIPELINE.length - 1 && (
                  <div
                    className="text-xs transition-colors duration-300"
                    style={{ color: animStep > i ? '#94a3b8' : '#e2e8f0' }}
                  >
                    +
                  </div>
                )}
              </div>
            ))}
            <div className="text-xs text-slate-300 mx-1">→</div>
            <div
              className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-500"
              style={{
                background: animStep >= PIPELINE.length ? 'rgba(59,130,246,0.12)' : 'rgba(148,163,184,0.06)',
                border: `1px solid ${animStep >= PIPELINE.length ? 'rgba(59,130,246,0.3)' : 'rgba(148,163,184,0.15)'}`,
                color: animStep >= PIPELINE.length ? '#3b82f6' : '#94a3b8',
              }}
            >
              FINAL FORECAST
            </div>
          </div>
        </div>

        {/* Timing */}
        <div className="grid grid-cols-3 gap-3 text-xs">
          {[
            { label: 'Last recalculation', value: ENGINE_STATUS.lastRecalculation },
            { label: 'Last data refresh', value: ENGINE_STATUS.lastDataRefresh },
            { label: 'Next update', value: ENGINE_STATUS.nextUpdate },
          ].map(t => (
            <div key={t.label} className="text-center">
              <div className="text-slate-400 mb-0.5">{t.label}</div>
              <div className="font-semibold text-slate-700">{t.value}</div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
