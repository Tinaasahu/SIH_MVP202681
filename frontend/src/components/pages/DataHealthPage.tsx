'use client';
import { DataHealthPanel } from '@/components/DataHealth';
import { GlassCard } from '@/components/ui/GlassCard';
import { Activity, Server } from 'lucide-react';
import { ENGINE_STATUS } from '@/lib/api';

export function DataHealthPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-600">
          <Activity size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Data &amp; Model Health</h1>
          <p className="text-xs text-slate-400">Pipeline latency, ingest status, and operational schedules</p>
        </div>
      </div>

      <DataHealthPanel />

      <GlassCard padding="md">
        <div className="flex items-center gap-2 mb-4">
          <Server size={15} className="text-slate-500" />
          <h2 className="text-xs font-semibold tracking-widest text-slate-500" style={{ letterSpacing: '0.12em' }}>
            OPERATIONAL PIPELINE STATUS
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Forecast Cycles', value: '4 / day (00, 06, 12, 18 UTC)' },
            { label: 'Reanalysis Ground Truth', value: 'ERA5 (ECMWF) via Open-Meteo' },
            { label: 'Weight Recalculation', value: 'Dynamic per cycle' },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl p-3.5"
              style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.12)' }}
            >
              <div className="text-xs text-slate-400 mb-1">{item.label}</div>
              <div className="text-sm font-semibold text-slate-700">{item.value}</div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
