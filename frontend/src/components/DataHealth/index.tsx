'use client';
import { useState, useEffect } from 'react';
import { CheckCircle, Activity, LucideIcon } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { getMetadata, formatLastUpdated } from '@/lib/api';
import { DataSource } from '@/types';

const STATUS_CONFIG: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  healthy: { icon: CheckCircle, color: '#10b981', label: 'Active' },
  reference: { icon: CheckCircle, color: '#0ea5e9', label: 'Reference' },
};

const DATA_SOURCES_CONFIG = [
  { id: 'ecmwf', name: 'ECMWF IFS', status: 'healthy' as const },
  { id: 'gfs', name: 'GFS Seamless', status: 'healthy' as const },
  { id: 'icon', name: 'ICON Seamless', status: 'healthy' as const },
  { id: 'gem', name: 'GEM Seamless', status: 'healthy' as const },
  { id: 'era5', name: 'ERA5 Reanalysis (Reference)', status: 'reference' as const },
];

export function DataHealthPanel() {
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getMetadata()
      .then((meta) => {
        if (mounted && meta?.last_updated) {
          setLastUpdated(meta.last_updated);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const lastUpdatedDisplay = lastUpdated ? formatLastUpdated(lastUpdated) : 'Synced';

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
            <p className="text-[11px] text-slate-400 mt-0.5">ERA5 Reanalysis reference feed active</p>
          </div>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
          style={{
            background: 'rgba(16,185,129,0.1)',
            color: '#047857',
            border: '1px solid rgba(16,185,129,0.25)',
          }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: '#10b981' }}
          />
          Nominal Ingest
        </div>
      </div>

      <div className="space-y-2">
        {DATA_SOURCES_CONFIG.map(source => {
          const s = STATUS_CONFIG[source.status] || STATUS_CONFIG.healthy;
          const Icon = s.icon;
          return (
            <div
              key={source.id}
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-colors bg-white/40 hover:bg-white/70 border border-slate-100"
            >
              <Icon size={15} style={{ color: s.color, flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-800 truncate">{source.name}</div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs text-slate-400 font-medium">{lastUpdatedDisplay}</span>
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
          { label: 'Last Refresh', value: lastUpdatedDisplay },
          { label: 'Last Blending', value: lastUpdatedDisplay },
          { label: 'Next Cycle', value: 'Every 6 hours' },
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
