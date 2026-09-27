'use client';

import { useState, useEffect } from 'react';
import { Activity, Clock, Database, Layers, MapPin, RefreshCw } from 'lucide-react';
import { getMetadata, MetadataRecord } from '@/lib/api';

function formatStatusStripDate(isoString?: string): string {
  if (!isoString) return '26 Sep 2026 • 23:45 IST';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '26 Sep 2026 • 23:45 IST';
    const day = d.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year} • ${hours}:${minutes} IST`;
  } catch {
    return '26 Sep 2026 • 23:45 IST';
  }
}

export function StatusStrip() {
  const [metadata, setMetadata] = useState<MetadataRecord>({
    last_updated: '2026-09-26T23:45:12',
    cities: 45,
    models: 4,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let mounted = true;
    getMetadata()
      .then((data) => {
        if (mounted && data) {
          setMetadata(data);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    getMetadata()
      .then((data) => {
        if (data) setMetadata(data);
      })
      .finally(() => {
        setTimeout(() => setIsRefreshing(false), 600);
      });
  };

  const formattedDate = formatStatusStripDate(metadata.last_updated);
  const cityCount = metadata.cities || metadata.city_count || 45;
  const modelCount = metadata.models || metadata.model_count || 4;

  return (
    <div
      className="mb-6 rounded-2xl px-5 py-3 transition-all duration-300"
      style={{
        background: 'linear-gradient(135deg, rgba(240, 253, 244, 0.92) 0%, rgba(255, 255, 255, 0.92) 45%, rgba(239, 246, 255, 0.92) 100%)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(167, 243, 208, 0.75)',
        boxShadow: '0 8px 32px 0 rgba(16, 185, 129, 0.08), inset 0 1px 1px 0 rgba(255, 255, 255, 0.95)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Item 1: Operational Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-50/80 border border-emerald-200/60 shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-bold text-emerald-700 tracking-wide uppercase">
              Operational Status
            </span>
          </div>
          <span className="text-xs font-extrabold text-slate-800 hidden sm:inline">
            Active · Auto-Updating
          </span>
        </div>

        {/* Status Metrics Items */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs">
          {/* Item 2: Last Updated */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-200/50">
              <Clock size={13} />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Last Updated
              </div>
              <div className="font-bold text-slate-700">
                {formattedDate}
              </div>
            </div>
          </div>

          <div className="hidden md:block w-px h-7 bg-slate-200/70" />

          {/* Item 3: Data Source */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-200/50">
              <Database size={13} />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Data Source
              </div>
              <div className="font-bold text-slate-700 flex items-center gap-1.5">
                <span>Live Open-Meteo</span>
                <span className="text-[10px] px-1 py-0.2 rounded bg-indigo-100/70 text-indigo-700 font-semibold">
                  API
                </span>
              </div>
            </div>
          </div>

          <div className="hidden md:block w-px h-7 bg-slate-200/70" />

          {/* Item 4: Models Blended */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-200/50">
              <Layers size={13} />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Models Blended
              </div>
              <div className="font-bold text-slate-700">
                {modelCount} <span className="font-medium text-slate-500">(ECMWF, GFS, ICON, GEM)</span>
              </div>
            </div>
          </div>

          <div className="hidden lg:block w-px h-7 bg-slate-200/70" />

          {/* Item 5: Forecast Stations */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-200/50">
              <MapPin size={13} />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Forecast Stations
              </div>
              <div className="font-bold text-slate-700">
                {cityCount} Cities
              </div>
            </div>
          </div>

          {/* Quick Refresh Icon */}
          <button
            type="button"
            onClick={handleManualRefresh}
            title="Refresh Status"
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
}
