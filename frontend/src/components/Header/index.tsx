'use client';
import { useState, useEffect } from 'react';
import { Bell, Settings, ChevronDown, Wind, ShieldAlert, Cpu, Eye, EyeOff } from 'lucide-react';
import { NavPage } from '@/types';
import { cn } from '@/lib/utils';
import { BlendingEngineModal } from '@/components/BlendingEngine';
import { AlertDrawer } from '@/components/AlertCenter';
import { getMetadata, formatLastUpdated } from '@/lib/api';

interface HeaderProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  isScenicMode?: boolean;
  onToggleScenic?: () => void;
}

const NAV_ITEMS: { id: NavPage; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'forecast', label: 'Forecast' },
  { id: 'rpi', label: 'RPI' },
  { id: 'model-intelligence', label: 'Model Intelligence' },
  { id: 'extreme-weather', label: 'Extreme Weather' },
  { id: 'model-performance', label: 'Performance' },
  { id: 'data-health', label: 'Data Health' },
];

export function Header({ currentPage, onNavigate, isScenicMode = false, onToggleScenic }: HeaderProps) {
  const [engineOpen, setEngineOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [lastUpdatedError, setLastUpdatedError] = useState(false);

  useEffect(() => {
    let mounted = true;
    getMetadata()
      .then((data) => {
        if (mounted && data?.last_updated) {
          setLastUpdated(data.last_updated);
        } else if (mounted) {
          setLastUpdatedError(true);
        }
      })
      .catch(() => {
        if (mounted) {
          setLastUpdatedError(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const lastUpdatedDisplay = lastUpdated ? formatLastUpdated(lastUpdated) : null;

  return (
    <>
      {/* Floating Boxed Taskbar Panel */}
      <header className="fixed top-3 left-3 right-3 sm:left-6 sm:right-6 z-40 max-w-[1400px] mx-auto">
        <div
          className="rounded-2xl px-5 py-2.5 transition-all duration-300"
          style={{
            background: 'rgba(255, 255, 255, 0.78)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.7)',
            boxShadow: '0 8px 32px 0 rgba(15, 23, 42, 0.08), inset 0 1px 1px 0 rgba(255, 255, 255, 0.9)',
          }}
        >
          {/* Main Top Bar */}
          <div className="flex items-center justify-between gap-4">
            {/* Logo & Brand Identity */}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden bg-white shadow-xs border border-slate-200/80 p-0.5"
              >
                <img
                  src="/logo-emblem.png"
                  alt="नभदृष्टि Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold text-slate-900 tracking-tight">
                    नभदृष्टि
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-100/70 text-blue-700 font-semibold border border-blue-200/50">
                    MoES · NCMRWF
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-medium tracking-wide">
                  AI–NWP Forecast Blending System
                </div>
              </div>
            </div>

            {/* Center Operational Metadata */}
            <div className="hidden lg:flex items-center gap-5 text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100/70 border border-slate-200/60">
                <span className="text-slate-400">Region:</span>
                <span className="font-semibold text-slate-700">All-India Gridded</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100/70 border border-slate-200/60">
                <span className="text-slate-400">Last Updated</span>
                {lastUpdatedDisplay ? (
                  <span className="font-semibold text-slate-700">{lastUpdatedDisplay}</span>
                ) : lastUpdatedError ? (
                  <span className="font-semibold text-slate-700">unavailable</span>
                ) : (
                  <span className="inline-block w-28 h-3.5 bg-slate-200/70 animate-pulse rounded" aria-label="Loading last updated time" />
                )}
              </div>
            </div>

            {/* Right Action Icons & Engine Pill */}
            <div className="flex items-center gap-2.5">
              {/* Blending Engine Active Trigger Button */}
              <button
                type="button"
                onClick={() => setEngineOpen(true)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#047857',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 status-pulse" />
                <span className="hidden sm:inline">Blending Engine Active</span>
                <span className="sm:hidden">Active</span>
              </button>

              {/* Alert Center Trigger */}
              <button
                type="button"
                onClick={() => setAlertOpen(true)}
                className="relative p-2 rounded-xl bg-white/70 hover:bg-white text-slate-600 border border-slate-200/60 transition-all hover:shadow-xs"
                title="Active Weather Alerts"
              >
                <Bell size={16} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              </button>

              {/* Scenic Sunset Landscape Peek Toggle */}
              {onToggleScenic && (
                <button
                  type="button"
                  onClick={onToggleScenic}
                  className={cn(
                    "relative p-2 rounded-xl border transition-all hover:shadow-xs",
                    isScenicMode
                      ? "bg-amber-500/25 text-amber-700 border-amber-400 shadow-xs"
                      : "bg-white/70 hover:bg-white text-slate-600 border-slate-200/60"
                  )}
                  title={isScenicMode ? "Restore Dashboard Cards" : "Peek Sunset Background Scenery"}
                >
                  {isScenicMode ? <EyeOff size={16} className="text-amber-600" /> : <Eye size={16} />}
                </button>
              )}

              {/* System Diagnostics Trigger */}
              <button
                type="button"
                onClick={() => onNavigate('data-health')}
                className="p-2 rounded-xl bg-white/70 hover:bg-white text-slate-600 border border-slate-200/60 transition-all hover:shadow-xs"
                title="Data & Model Health"
              >
                <Cpu size={16} />
              </button>
            </div>
          </div>

          {/* Navigation Bar inside Boxed Panel */}
          <nav className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-100 overflow-x-auto no-scrollbar">
            {NAV_ITEMS.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`relative flex-shrink-0 px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <BlendingEngineModal open={engineOpen} onClose={() => setEngineOpen(false)} />
      <AlertDrawer open={alertOpen} onClose={() => setAlertOpen(false)} />
    </>
  );
}
