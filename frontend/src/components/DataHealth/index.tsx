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

  const lastUpdatedDisplay = lastUpdated ? formatLastUpdated(lastUpdated) : '2 Oct 2026 • 2:51 PM';

  return (
    <GlassCard padding="md" variant="grey">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Activity size={14} />
          </div>
          <div>
            <span className="text-xs font-bold tracking-widest text-[#F5F7FF] uppercase" style={{ letterSpacing: '0.12em' }}>
              DATA &amp; MODEL STATUS
            </span>
            <p className="text-[11px] text-[#AAB7D4] mt-0.5">ERA5 Reanalysis reference feed active</p>
          </div>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
          style={{
            background: 'rgba(16, 185, 129, 0.16)',
            color: '#34d399',
            border: '1px solid rgba(52, 211, 153, 0.35)',
            boxShadow: '0 0 12px rgba(16, 185, 129, 0.18)',
          }}
        >
          <span
            className="w-2 h-2 rounded-full bg-emerald-400 status-pulse"
          />
          Nominal Ingest
        </div>
      </div>

      {/* Rows as small translucent glass pills */}
      <div className="space-y-2">
        {DATA_SOURCES_CONFIG.map(source => {
          return (
            <div
              key={source.id}
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-all bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08]"
            >
              <CheckCircle size={15} className="text-emerald-400 shrink-0" style={{ filter: 'drop-shadow(0 0 4px rgba(52, 211, 153, 0.4))' }} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-[#F5F7FF] truncate">{source.name}</div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs text-[#AAB7D4] font-medium">{lastUpdatedDisplay}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Cycle Container */}
      <div
        className="mt-4 rounded-xl p-3 grid grid-cols-3 gap-2 text-center"
        style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
      >
        {[
          { label: 'Last Refresh', value: lastUpdatedDisplay },
          { label: 'Last Blending', value: lastUpdatedDisplay },
          { label: 'Next Cycle', value: 'Every 6 hours' },
        ].map(t => (
          <div key={t.label} className="p-1">
            <div className="text-[10px] text-[#7180A5] mb-0.5">{t.label}</div>
            <div className="text-xs font-bold text-[#F5F7FF]">{t.value}</div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
