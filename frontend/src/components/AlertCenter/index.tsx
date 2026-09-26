'use client';
import { useState, useEffect, useMemo } from 'react';
import { X, AlertCircle, AlertTriangle, Info, MapPin, RotateCcw, ShieldAlert, CheckCircle2, ChevronDown } from 'lucide-react';
import { getAlertsData, MOCK_ALERTS, getAlertState } from '@/lib/api';
import type { Alert } from '@/types';

interface AlertDrawerProps {
  open: boolean;
  onClose: () => void;
}

type SeverityFilter = 'all' | 'danger' | 'warning';

const alertStyles: Record<Alert['type'], { bg: string; border: string; icon: React.ElementType; iconColor: string; dot: string }> = {
  danger: { bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.22)', icon: AlertCircle, iconColor: '#ef4444', dot: '#ef4444' },
  warning: { bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.22)', icon: AlertTriangle, iconColor: '#f59e0b', dot: '#f59e0b' },
  info: { bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.22)', icon: Info, iconColor: '#3b82f6', dot: '#3b82f6' },
};

export function AlertDrawer({ open, onClose }: AlertDrawerProps) {
  const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [selectedState, setSelectedState] = useState<string>('all');

  useEffect(() => {
    let mounted = true;
    getAlertsData()
      .then((data) => {
        if (mounted && data && data.length > 0) {
          setAlerts(data);
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

  const redCount = useMemo(() => alerts.filter((a) => a.type === 'danger').length, [alerts]);
  const orangeCount = useMemo(() => alerts.filter((a) => a.type === 'warning').length, [alerts]);

  const uniqueStates = useMemo(() => {
    const map = new Map<string, number>();
    alerts.forEach((a) => {
      const st = a.state || getAlertState(a.location);
      if (st && st !== 'Other') {
        map.set(st, (map.get(st) || 0) + 1);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (severityFilter !== 'all' && a.type !== severityFilter) {
        return false;
      }
      if (selectedState !== 'all') {
        const st = a.state || getAlertState(a.location);
        if (st !== selectedState) {
          return false;
        }
      }
      return true;
    });
  }, [alerts, severityFilter, selectedState]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 modal-backdrop" onClick={onClose} />
      <div
        className="relative w-full max-w-md h-full flex flex-col"
        style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderLeft: '1px solid rgba(148,163,184,0.22)',
          boxShadow: '-12px 0 48px rgba(15,23,42,0.12)',
          animation: 'slideIn 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center text-red-600">
              <ShieldAlert size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold tracking-widest text-slate-800" style={{ letterSpacing: '0.12em' }}>
                  ALERT CENTER
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {alerts.length} Total
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Extreme Hazard Warning Registry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 space-y-2.5">
          {/* Severity Filter Tabs (Red / Orange / All) */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/70">
            <button
              type="button"
              onClick={() => setSeverityFilter('all')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                severityFilter === 'all'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>All</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                severityFilter === 'all' ? 'bg-slate-100 text-slate-700' : 'bg-slate-300/60 text-slate-600'
              }`}>
                {alerts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSeverityFilter('danger')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                severityFilter === 'danger'
                  ? 'bg-red-500 text-white shadow-xs'
                  : 'text-red-700 hover:bg-red-100/60'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${severityFilter === 'danger' ? 'bg-white' : 'bg-red-500 animate-pulse'}`} />
              <span>Red</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                severityFilter === 'danger' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700'
              }`}>
                {redCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSeverityFilter('warning')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                severityFilter === 'warning'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-amber-800 hover:bg-amber-100/60'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${severityFilter === 'warning' ? 'bg-white' : 'bg-amber-500 animate-pulse'}`} />
              <span>Orange</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                severityFilter === 'warning' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {orangeCount}
              </span>
            </button>
          </div>

          {/* Statewise Dropdown Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <MapPin size={13} />
              </div>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full text-xs font-semibold pl-7 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 shadow-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer appearance-none"
              >
                <option value="all">All States ({alerts.length} total)</option>
                {uniqueStates.map(([st, count]) => (
                  <option key={st} value={st}>
                    {st} ({count} alerts)
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-400">
                <ChevronDown size={13} />
              </div>
            </div>

            {(severityFilter !== 'all' || selectedState !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSeverityFilter('all');
                  setSelectedState('all');
                }}
                className="px-2.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-medium flex items-center gap-1 transition-colors"
                title="Reset filters"
              >
                <RotateCcw size={12} />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>

          {/* Filter Status readout */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
            <span>
              Showing <strong className="text-slate-800">{filteredAlerts.length}</strong> of {alerts.length} alerts
            </span>
            {selectedState !== 'all' && (
              <span className="text-blue-600 font-semibold truncate max-w-[170px]">
                {selectedState}
              </span>
            )}
          </div>
        </div>

        {/* Alerts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredAlerts.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-2xl bg-slate-50/80 border border-slate-100">
              <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={20} />
              </div>
              <h4 className="text-sm font-bold text-slate-800">No Alerts Found</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                No {severityFilter === 'danger' ? 'Red' : severityFilter === 'warning' ? 'Orange' : ''} hazard advisories match the current state filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSeverityFilter('all');
                  setSelectedState('all');
                }}
                className="mt-4 px-3.5 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            filteredAlerts.map((alert) => {
              const s = alertStyles[alert.type] || alertStyles.warning;
              const Icon = s.icon;
              const isRed = alert.type === 'danger';

              return (
                <div
                  key={alert.id}
                  className="w-full text-left rounded-xl p-3.5 transition-all hover:scale-[1.01] hover:shadow-xs"
                  style={{ background: s.bg, border: `1px solid ${s.border}` }}
                >
                  <div className="flex items-start gap-3">
                    <Icon size={16} style={{ color: s.iconColor, flexShrink: 0, marginTop: 2 }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-bold text-slate-800 truncate">{alert.title}</div>
                        <span
                          className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md tracking-wider shrink-0 ${
                            isRed
                              ? 'bg-red-100 text-red-700 border border-red-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {isRed ? 'Red Alert' : 'Orange Alert'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5 font-medium flex items-center gap-1">
                        <MapPin size={11} className="text-slate-400 shrink-0" />
                        <span className="truncate">{alert.location}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-200/50">
                        <span className="text-xs text-slate-400">{alert.window}</span>
                        <span className="text-xs font-bold text-slate-700 bg-white/90 px-2 py-0.5 rounded-md border border-slate-200/60">
                          {alert.timestamp}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-white/60">
          <p className="text-[11px] text-slate-400 text-center">
            Alerts generated from multi-model blending engine. For operational disaster deployment, refer to IMD/NCMRWF bulletins.
          </p>
        </div>
      </div>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

