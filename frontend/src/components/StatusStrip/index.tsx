'use client';

import { useState, useEffect } from 'react';
import { Activity, Clock, Database, Layers, MapPin, RefreshCw } from 'lucide-react';
import { getMetadata, MetadataRecord } from '@/lib/api';

function formatStatusStripDate(isoString?: string): string {
  if (!isoString) return '29 Sep 2026 • 00:30 IST';
  try {
    let clean = isoString.trim();
    if (!clean.endsWith('Z') && !clean.includes('+') && !clean.includes('-', 10)) {
      clean += 'Z';
    }
    const d = new Date(clean);
    if (isNaN(d.getTime())) return '29 Sep 2026 • 00:30 IST';

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    let day = '', month = '', year = '', hour = '', minute = '';
    for (const p of parts) {
      if (p.type === 'day') day = p.value;
      if (p.type === 'month') month = p.value;
      if (p.type === 'year') year = p.value;
      if (p.type === 'hour') hour = p.value;
      if (p.type === 'minute') minute = p.value;
    }
    return `${day} ${month} ${year} • ${hour}:${minute} IST`;
  } catch {
    return '29 Sep 2026 • 00:30 IST';
  }
}

export function StatusStrip() {
  const [metadata, setMetadata] = useState<MetadataRecord | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isWakingUp, setIsWakingUp] = useState(false);
  const [isError, setIsError] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    getMetadata()
      .then((data) => {
        if (mounted && data) {
          setMetadata(data);
          setIsWakingUp(false);
          setIsError(false);
        } else if (mounted) {
          setIsError(true);
        }
      })
      .catch((err) => {
        if (mounted) {
          setIsError(true);
          setIsWakingUp(false);
          setStatusMessage(err?.message || 'Server is waking up. Please try again.');
        }
      });

    const handleStatus = (e: Event) => {
      const customEvent = e as CustomEvent<{ wakingUp?: boolean; error?: boolean; message?: string }>;
      if (mounted && customEvent.detail) {
        setIsWakingUp(!!customEvent.detail.wakingUp);
        setIsError(!!customEvent.detail.error);
        if (customEvent.detail.message) {
          setStatusMessage(customEvent.detail.message);
        }
      }
    };

    window.addEventListener('backend-status', handleStatus);

    return () => {
      mounted = false;
      window.removeEventListener('backend-status', handleStatus);
    };
  }, []);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setIsError(false);
    getMetadata()
      .then((data) => {
        if (data) {
          setMetadata(data);
          setIsError(false);
          setIsWakingUp(false);
        } else {
          setIsError(true);
        }
      })
      .catch((err) => {
        setIsError(true);
        setIsWakingUp(false);
        setStatusMessage(err?.message || 'Server is waking up. Please try again.');
      })
      .finally(() => {
        setTimeout(() => setIsRefreshing(false), 600);
      });
  };

  const formattedDate = metadata?.last_updated ? formatStatusStripDate(metadata.last_updated) : null;
  const cityCount = metadata ? (metadata.cities || metadata.city_count || 45) : null;
  const modelCount = metadata ? (metadata.models || metadata.model_count || 4) : null;

  return (
    <div
      className="mb-6 rounded-2xl px-5 py-3 transition-all duration-300"
      style={{
        background: 'linear-gradient(135deg, rgba(240, 253, 244, 0.95) 0%, rgba(255, 255, 255, 0.95) 45%, rgba(239, 246, 255, 0.95) 100%)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(167, 243, 208, 0.75)',
        boxShadow: '0 8px 32px 0 rgba(16, 185, 129, 0.08), inset 0 1px 1px 0 rgba(255, 255, 255, 0.95)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Item 1: Operational Status */}
        <div className="flex items-center gap-3">
          {isWakingUp ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-50/90 border border-amber-200/80 shadow-2xs">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin inline-block" />
              <span className="text-[11px] font-bold text-amber-700 tracking-wide uppercase">
                Connecting
              </span>
            </div>
          ) : isError ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-red-50/90 border border-red-200/80 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="text-[11px] font-bold text-red-700 tracking-wide uppercase">
                Standby
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-50/80 border border-emerald-200/60 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-bold text-emerald-700 tracking-wide uppercase">
                Operational Status
              </span>
            </div>
          )}

          <span className={`text-xs font-bold ${isWakingUp ? 'text-amber-800' : isError ? 'text-red-700' : 'text-slate-800 hidden sm:inline'}`}>
            {isWakingUp
              ? 'Starting AI weather engine… This may take up to 60 seconds.'
              : isError
              ? (statusMessage || 'Server is waking up. Please try again.')
              : 'Active · Auto-Updating'}
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
                {formattedDate ? (
                  formattedDate
                ) : isError ? (
                  'unavailable'
                ) : (
                  <span className="inline-block w-28 h-3.5 bg-slate-200/70 animate-pulse rounded" aria-label="Loading last updated time" />
                )}
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
                {modelCount !== null ? (
                  <>
                    {modelCount} <span className="font-medium text-slate-500">(ECMWF, GFS, ICON, GEM)</span>
                  </>
                ) : isError ? (
                  'unavailable'
                ) : (
                  <span className="inline-block w-14 h-3.5 bg-slate-200/70 animate-pulse rounded" aria-label="Loading models count" />
                )}
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
                {cityCount !== null ? (
                  <>{cityCount} Cities</>
                ) : isError ? (
                  'unavailable'
                ) : (
                  <span className="inline-block w-14 h-3.5 bg-slate-200/70 animate-pulse rounded" aria-label="Loading forecast stations count" />
                )}
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
