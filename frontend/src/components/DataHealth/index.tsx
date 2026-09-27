'use client';
import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, XCircle, Activity, Clock } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { MOCK_DATA_SOURCES, ENGINE_STATUS, getForecast } from '@/lib/api';
import { DataSource } from '@/types';

const STATUS_CONFIG: Record<DataSource['status'], { icon: React.ElementType; color: string; label: string }> = {
  healthy: { icon: CheckCircle, color: '#10b981', label: 'Healthy' },
  delayed: { icon: AlertCircle, color: '#f59e0b', label: 'Delayed' },
  unavailable: { icon: XCircle, color: '#ef4444', label: 'Unavailable' },
};

export function DataHealthPanel() {
  const [sources, setSources] = useState<DataSource[]>(MOCK_DATA_SOURCES);
  const [engineStatus, setEngineStatus] = useState(ENGINE_STATUS);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let mounted = true;
    getForecast()
      .then((data) => {
        if (mounted && data && data.length > 0) {
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

  const healthyCount = sources.filter(s => s.status === 'healthy').length;

  return (
    <GlassCard padding="md" variant="grey">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <Activity size={14} />
          </div>
          <div>
            <span className="text-xs font-bold tracking-widest text-slate-700 uppercase" style={{ letterSpacing: '0.12em' }}>
              DATA &amp; MODEL STATUS
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">{healthyCount}/{sources.length} feeds nominal</p>
          </div>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
          style={{
            background: healthyCount >= sources.length * 0.8 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
            color: healthyCount >= sources.length * 0.8 ? '#047857' : '#b45309',
            border: `1px solid ${healthyCount >= sources.length * 0.8 ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
          }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: healthyCount >= sources.length * 0.8 ? '#10b981' : '#f59e0b' }}
          />
          {healthyCount >= sources.length * 0.8 ? 'Nominal Ingest' : 'Degraded Feed'}
        </div>
      </div>

      <div className="space-y-2">
        {sources.map(source => {
          const s = STATUS_CONFIG[source.status];
          const Icon = s.icon;
          return (
            <div
              key={source.id}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-colors ${
                source.status !== 'healthy'
                  ? 'bg-amber-50/60 border border-amber-200/60'
                  : 'bg-white/40 hover:bg-white/70 border border-slate-100'
              }`}
            >
              <Icon size={15} style={{ color: s.color, flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-800 truncate">{source.name}</div>
                {source.status !== 'healthy' && (
                  <div className="text-[11px] text-amber-700 font-medium">Last sync: {source.lastUpdated}</div>
                )}
              </div>
              <div className="text-right shrink-0">
                {source.status === 'healthy' ? (
                  <span className="text-xs text-slate-400 font-medium">{source.lastUpdated}</span>
                ) : (
                  <span className="text-xs font-bold" style={{ color: s.color }}>{s.label}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="mt-4 rounded-xl p-3 grid grid-cols-3 gap-2 text-center"
        style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.12)' }}
      >
        {[
          { label: 'Last Refresh', value: engineStatus.lastDataRefresh },
          { label: 'Last Blending', value: engineStatus.lastRecalculation },
          { label: 'Next Cycle', value: engineStatus.nextUpdate },
        ].map(t => (
          <div key={t.label} className="p-1">
            <div className="text-[10px] text-slate-400 mb-0.5">{t.label}</div>
            <div className="text-xs font-bold text-slate-700">{t.value}</div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
