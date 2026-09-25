'use client';
import { useState, useEffect } from 'react';
import { ExtremeWeatherPanel } from '@/components/ExtremeWeather';
import { AlertDrawer } from '@/components/AlertCenter';
import { GlassCard } from '@/components/ui/GlassCard';
import { WeatherMap } from '@/components/WeatherMap';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { getAlertsData, MOCK_ALERTS } from '@/lib/api';
import type { Alert } from '@/types';

export function ExtremeWeatherPage() {
  const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

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
      <GlassCard padding="md">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={15} className="text-amber-500" />
          <h2 className="text-xs font-semibold tracking-widest text-slate-500" style={{ letterSpacing: '0.12em' }}>
            ACTIVE ALERT REGISTRY
          </h2>
        </div>
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: 'rgba(148,163,184,0.04)', border: '1px solid rgba(148,163,184,0.1)' }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: alert.type === 'danger' ? '#ef4444' : alert.type === 'warning' ? '#f59e0b' : '#3b82f6',
                  }}
                />
                <div>
                  <div className="text-sm font-semibold text-slate-800">{alert.title}</div>
                  <div className="text-xs text-slate-400">{alert.location}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500 font-medium">{alert.window}</div>
                <div className="text-[10px] text-slate-400">{alert.timestamp}</div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
