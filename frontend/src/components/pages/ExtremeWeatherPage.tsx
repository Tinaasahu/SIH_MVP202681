'use client';
import { useState, useEffect, useMemo } from 'react';
import { ExtremeWeatherPanel } from '@/components/ExtremeWeather';
import { GlassCard } from '@/components/ui/GlassCard';
import { WeatherMap } from '@/components/WeatherMap';
import { AlertTriangle, ShieldAlert, MapPin, RotateCcw, CheckCircle2, ChevronDown } from 'lucide-react';
import { getAlertsData, MOCK_ALERTS, getAlertState } from '@/lib/api';
import type { Alert } from '@/types';

type SeverityFilter = 'all' | 'danger' | 'warning';

export function ExtremeWeatherPage() {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-600">
          <ShieldAlert size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Extreme Weather Guidance</h1>
          <p className="text-xs text-slate-400">Probabilistic risk alerts for heavy rain, heatwave, and high wind</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExtremeWeatherPanel />
        <WeatherMap />
      </div>

      {/* Active alerts log */}
      <GlassCard padding="md" variant="red">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <AlertTriangle size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold tracking-widest text-slate-800 uppercase" style={{ letterSpacing: '0.12em' }}>
                  ACTIVE ALERT REGISTRY
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {filteredAlerts.length} / {alerts.length} Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Gridded hazard threshold breaches from multi-model blending
              </p>
            </div>
          </div>

          {/* Filters: Red/Orange pills + Statewise selector */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Severity Filter Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/90 border border-slate-200/70">
              <button
                type="button"
                onClick={() => setSeverityFilter('all')}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  severityFilter === 'all'
                    ? 'bg-white text-slate-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>All</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 font-bold">
                  {alerts.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSeverityFilter('danger')}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  severityFilter === 'danger'
                    ? 'bg-red-500 text-white shadow-xs'
                    : 'text-red-700 hover:bg-red-50'
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
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  severityFilter === 'warning'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-amber-800 hover:bg-amber-50'
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
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <MapPin size={13} />
              </div>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="text-xs font-semibold pl-7 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 shadow-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer appearance-none"
              >
                <option value="all">All States ({alerts.length})</option>
                {uniqueStates.map(([st, count]) => (
                  <option key={st} value={st}>
                    {st} ({count})
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-400">
                <ChevronDown size={13} />
              </div>
            </div>

            {/* Reset Button */}
            {(severityFilter !== 'all' || selectedState !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSeverityFilter('all');
                  setSelectedState('all');
                }}
                className="px-2.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-medium flex items-center gap-1 transition-colors"
                title="Reset filters"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Alerts list */}
        <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
          {filteredAlerts.length === 0 ? (
            <div className="py-14 px-4 text-center rounded-2xl bg-slate-50/80 border border-slate-100">
              <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={22} />
              </div>
              <h4 className="text-sm font-bold text-slate-800">No Active Alerts Found</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No {severityFilter === 'danger' ? 'Red' : severityFilter === 'warning' ? 'Orange' : ''} hazard advisories match the chosen state or severity filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSeverityFilter('all');
                  setSelectedState('all');
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition-colors shadow-xs"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            filteredAlerts.map((alert) => {
              const isRed = alert.type === 'danger';
              return (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-3.5 rounded-xl transition-all hover:scale-[1.003] hover:shadow-xs"
                  style={{
                    background: isRed ? 'rgba(239,68,68,0.04)' : 'rgba(245,158,11,0.04)',
                    border: isRed ? '1px solid rgba(239,68,68,0.18)' : '1px solid rgba(245,158,11,0.18)',
                  }}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        background: isRed ? '#ef4444' : '#f59e0b',
                        boxShadow: isRed ? '0 0 8px rgba(239,68,68,0.6)' : '0 0 8px rgba(245,158,11,0.6)',
                      }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800 truncate">{alert.title}</span>
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
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin size={11} className="text-slate-400 shrink-0" />
                        <span className="truncate">{alert.location}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="text-xs text-slate-700 font-semibold">{alert.window}</div>
                    <div className="text-xs font-bold text-blue-600 mt-0.5 bg-white/80 px-2 py-0.5 rounded-md border border-slate-200/60 inline-block">
                      {alert.timestamp}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </GlassCard>
    </div>
  );
}
