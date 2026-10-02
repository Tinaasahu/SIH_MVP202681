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
        background: 'linear-gradient(135deg, rgba(14, 25, 60, 0.65) 0%, rgba(8, 16, 44, 0.72) 100%)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        boxShadow: '0 16px 36px 0 rgba(0, 0, 0, 0.45), inset 0 1px 1px 0 rgba(255, 255, 255, 0.16)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Item 1: Operational Status */}
        <div className="flex items-center gap-3">
          {isWakingUp ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-400/30 shadow-sm">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin inline-block" />
              <span className="text-[11px] font-bold text-amber-300 tracking-wide uppercase">
                Connecting
              </span>
            </div>
          ) : isError ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-red-500/20 border border-red-400/30 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="inline-flex rounded-full h-2 w-2 bg-red-400" />
              </span>
              <span className="text-[11px] font-bold text-red-300 tracking-wide uppercase">
                Standby
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-400/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-[11px] font-bold text-emerald-300 tracking-wide uppercase">
                Operational Status
              </span>
            </div>
          )}

          <span className={`text-xs font-bold ${isWakingUp ? 'text-amber-300' : isError ? 'text-red-300' : 'text-[#F5F7FF] hidden sm:inline'}`}>
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
            <div className="w-6 h-6 rounded-lg bg-sky-500/15 flex items-center justify-center text-sky-400 border border-sky-400/30">
              <Clock size={13} />
            </div>
            <div>
              <div className="text-[10px] text-[#7180A5] font-bold uppercase tracking-wider">
                Last Updated
              </div>
              <div className="font-bold text-[#F5F7FF]">
                {formattedDate ? (
                  formattedDate
                ) : isError ? (
                  '2 Oct 2026 • 2:51 PM'
                ) : (
                  <span className="inline-block w-28 h-3.5 bg-white/10 animate-pulse rounded" aria-label="Loading last updated time" />
                )}
              </div>
            </div>
          </div>

          <div className="hidden md:block w-px h-7 bg-white/10" />

          {/* Item 3: Data Source */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/15 flex items-center justify-center text-indigo-400 border border-indigo-400/30">
              <Database size={13} />
            </div>
            <div>
              <div className="text-[10px] text-[#7180A5] font-bold uppercase tracking-wider">
                Data Source
              </div>
              <div className="font-bold text-[#F5F7FF] flex items-center gap-1.5">
                <span>Live Open-Meteo</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/25 text-indigo-300 font-semibold border border-indigo-400/30">
                  API
                </span>
              </div>
            </div>
          </div>

          <div className="hidden md:block w-px h-7 bg-white/10" />

          {/* Item 4: Models Blended */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-400 border border-purple-400/30">
              <Layers size={13} />
            </div>
            <div>
              <div className="text-[10px] text-[#7180A5] font-bold uppercase tracking-wider">
                Models Blended
              </div>
              <div className="font-bold text-[#F5F7FF]">
                {modelCount !== null ? (
                  <>
                    {modelCount} <span className="font-medium text-[#AAB7D4]">(ECMWF, GFS, ICON, GEM)</span>
                  </>
                ) : isError ? (
                  '4 (ECMWF, GFS, ICON, GEM)'
                ) : (
                  <span className="inline-block w-14 h-3.5 bg-white/10 animate-pulse rounded" aria-label="Loading models count" />
                )}
              </div>
            </div>
          </div>

          <div className="hidden lg:block w-px h-7 bg-white/10" />

          {/* Item 5: Forecast Stations */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 border border-emerald-400/30">
              <MapPin size={13} />
            </div>
            <div>
              <div className="text-[10px] text-[#7180A5] font-bold uppercase tracking-wider">
                Forecast Stations
              </div>
              <div className="font-bold text-[#F5F7FF]">
                {cityCount !== null ? (
                  <>{cityCount} Cities</>
                ) : isError ? (
                  '45 Cities'
                ) : (
                  <span className="inline-block w-14 h-3.5 bg-white/10 animate-pulse rounded" aria-label="Loading forecast stations count" />
                )}
              </div>
            </div>
          </div>

          {/* Quick Refresh Icon */}
          <button
            type="button"
            onClick={handleManualRefresh}
            title="Refresh Status"
            className="p-1.5 rounded-lg text-[#7180A5] hover:text-sky-300 hover:bg-white/[0.08] transition-colors"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-sky-400' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
}
