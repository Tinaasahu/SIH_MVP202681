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

    const fetchMeta = () => {
      getMetadata()
        .then((data) => {
          if (mounted && data?.last_updated) {
            setLastUpdated(data.last_updated);
            setLastUpdatedError(false);
          } else if (mounted) {
            setLastUpdatedError(true);
          }
        })
        .catch(() => {
          if (mounted) {
            setLastUpdatedError(true);
          }
        });
    };

    fetchMeta();
    const interval = setInterval(fetchMeta, 60000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const lastUpdatedDisplay = lastUpdated ? formatLastUpdated(lastUpdated) : null;

  return (
    <>
      {/* Floating Boxed Taskbar Panel */}
      <header className="fixed top-3 left-3 right-3 sm:left-6 sm:right-6 z-40 max-w-[1400px] mx-auto">
        <div
          className="rounded-2xl px-5 py-3 transition-all duration-300"
          style={{
            background: 'rgba(8, 13, 32, 0.65)',
            backdropFilter: 'blur(22px) saturate(115%)',
            WebkitBackdropFilter: 'blur(22px) saturate(115%)',
            border: '1px solid rgba(220, 225, 255, 0.14)',
            boxShadow: '0 16px 45px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
          }}
        >
          {/* Main Top Bar */}
          <div className="flex items-center justify-between gap-4">
            {/* Logo & Brand Identity */}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden bg-white/10 shadow-sm border border-white/15 p-1 backdrop-blur-md"
              >
                <img
                  src="/logo-emblem.png"
                  alt="नभदृष्टि Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold text-[#F3F5FA] tracking-tight">
                    नभदृष्टि
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.08] text-[#F3F5FA] font-semibold border border-white/15">
                    MoES · NCMRWF
                  </span>
                </div>
                <div className="text-[10px] text-[#A9B2C8] font-medium tracking-wide">
                  AI–NWP Forecast Blending System
                </div>
              </div>
            </div>

            {/* Center Operational Metadata */}
            <div className="hidden lg:flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#A9B2C8]">
                <span className="text-[#747F9C]">Region:</span>
                <span className="font-semibold text-[#F3F5FA]">All-India Gridded</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#A9B2C8]">
                <span className="text-[#747F9C]">Last Updated:</span>
                {lastUpdatedDisplay ? (
                  <span className="font-semibold text-[#F3F5FA]">{lastUpdatedDisplay}</span>
                ) : lastUpdatedError ? (
                  <span className="font-semibold text-[#F3F5FA]">{formatLastUpdated()}</span>
                ) : (
                  <span className="inline-block w-28 h-3.5 bg-white/10 animate-pulse rounded" aria-label="Loading last updated time" />
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
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#34d399',
                  border: '1px solid rgba(52, 211, 153, 0.25)',
                  boxShadow: '0 0 12px rgba(16, 185, 129, 0.12)',
                }}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 status-pulse" />
                <span className="hidden sm:inline">Blending Engine Active</span>
                <span className="sm:hidden">Active</span>
              </button>

              {/* Alert Center Trigger */}
              <button
                type="button"
                onClick={() => setAlertOpen(true)}
                className="relative p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-[#A9B2C8] hover:text-[#F3F5FA] border border-white/10 transition-all hover:shadow-sm"
                title="Active Weather Alerts"
              >
                <Bell size={16} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-400 rounded-full animate-pulse shadow-[0_0_8px_#f87171]" />
              </button>

              {/* Scenic Night Landscape Peek Toggle */}
              {onToggleScenic && (
                <button
                  type="button"
                  onClick={onToggleScenic}
                  className={cn(
                    "relative p-2 rounded-xl border transition-all hover:shadow-sm",
                    isScenicMode
                      ? "bg-sky-500/20 text-sky-300 border-sky-400/40 shadow-sm"
                      : "bg-white/[0.06] hover:bg-white/[0.12] text-[#A9B2C8] hover:text-[#F3F5FA] border border-white/10"
                  )}
                  title={isScenicMode ? "Restore Dashboard Cards" : "Peek Night Background Scenery"}
                >
                  {isScenicMode ? <EyeOff size={16} className="text-sky-300" /> : <Eye size={16} />}
                </button>
              )}

              {/* System Diagnostics Trigger */}
              <button
                type="button"
                onClick={() => onNavigate('data-health')}
                className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-[#A9B2C8] hover:text-[#F3F5FA] border border-white/10 transition-all hover:shadow-sm"
                title="Data & Model Health"
              >
                <Cpu size={16} />
              </button>
            </div>
          </div>

          {/* Navigation Bar inside Boxed Panel */}
          <nav className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-white/10 overflow-x-auto no-scrollbar">
            {NAV_ITEMS.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`relative flex-shrink-0 px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-sky-500/20 text-[#F3F5FA] border border-sky-400/30 shadow-sm'
                      : 'text-[#A9B2C8] hover:text-[#F3F5FA] hover:bg-white/[0.06]'
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
