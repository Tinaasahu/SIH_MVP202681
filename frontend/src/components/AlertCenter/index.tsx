'use client';
import { useState, useEffect } from 'react';
import { X, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { getAlertsData, MOCK_ALERTS } from '@/lib/api';
import type { Alert } from '@/types';

interface AlertDrawerProps {
  open: boolean;
  onClose: () => void;
}

const alertStyles: Record<Alert['type'], { bg: string; border: string; icon: React.ElementType; iconColor: string; dot: string }> = {
  danger: { bg: 'rgba(239,68,68,0.05)', border: 'rgba(239,68,68,0.15)', icon: AlertCircle, iconColor: '#ef4444', dot: '#ef4444' },
  warning: { bg: 'rgba(245,158,11,0.05)', border: 'rgba(245,158,11,0.15)', icon: AlertTriangle, iconColor: '#f59e0b', dot: '#f59e0b' },
  info: { bg: 'rgba(59,130,246,0.05)', border: 'rgba(59,130,246,0.15)', icon: Info, iconColor: '#3b82f6', dot: '#3b82f6' },
};

export function AlertDrawer({ open, onClose }: AlertDrawerProps) {
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 modal-backdrop" onClick={onClose} />
      <div
        className="relative w-full max-w-sm h-full flex flex-col"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderLeft: '1px solid rgba(148,163,184,0.18)',
          boxShadow: '-8px 0 48px rgba(15,23,42,0.08)',
          animation: 'slideIn 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <span className="text-xs font-semibold tracking-widest text-slate-500" style={{ letterSpacing: '0.12em' }}>
            ALERT CENTER
          </span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {alerts.map((alert) => {
            const s = alertStyles[alert.type];
            const Icon = s.icon;
            return (
              <button
                key={alert.id}
                className="w-full text-left rounded-xl p-3.5 transition-all hover:scale-[1.01]"
                style={{ background: s.bg, border: `1px solid ${s.border}` }}
              >
                <div className="flex items-start gap-3">
                  <Icon size={16} style={{ color: s.iconColor, flexShrink: 0, marginTop: 1 }} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">{alert.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{alert.location}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-slate-400">{alert.window}</span>
                      <span className="text-slate-200">·</span>
                      <span className="text-xs text-slate-400">{alert.timestamp}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-slate-100">
          <p className="text-xs text-slate-400 text-center">Alerts generated from blending engine output. For operational guidance, refer to IMD/NCMRWF bulletins.</p>
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
