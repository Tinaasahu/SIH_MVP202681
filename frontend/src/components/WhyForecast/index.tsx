'use client';
import { Modal } from '@/components/ui/Modal';
import { MOCK_MODEL_WEIGHTS } from '@/data/mockData';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface WhyForecastModalProps {
  open: boolean;
  onClose: () => void;
}

export function WhyForecastModal({ open, onClose }: WhyForecastModalProps) {
  const weights = MOCK_MODEL_WEIGHTS;

  return (
    <Modal open={open} onClose={onClose} title="WHY THIS FORECAST?" size="md">
      <div className="space-y-5">
        {/* Context grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Current weather regime', value: 'Heavy Rainfall', highlight: true },
            { label: 'Lead time', value: '24 hours', highlight: false },
            { label: 'Historical regional skill', value: 'High', highlight: false },
            { label: 'Model agreement', value: 'Moderate', highlight: false },
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
          <h3 className="text-xs font-semibold text-blue-600 mb-2">Reasoning</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            AI Model currently demonstrates stronger historical performance for this region and lead time, while NWP contributes additional physical consistency. Ensemble components are weighted lower due to moderate agreement under active monsoon conditions.
          </p>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-slate-400 leading-relaxed">
          This forecast is based on statistical blending of NWP and AI model outputs. It is intended for decision-support and should not replace official IMD/NCMRWF operational guidance.
        </p>
      </div>
    </Modal>
  );
}
