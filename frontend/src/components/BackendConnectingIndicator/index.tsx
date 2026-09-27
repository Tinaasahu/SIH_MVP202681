'use client';

import { useState, useEffect, useRef } from 'react';
import { getBackendStatus, BackendStatusType } from '@/lib/api';

/**
 * BackendConnectingIndicator
 * 
 * Displays a lightweight, compact status pill/banner ONLY while the Render backend is connecting / waking up.
 * - Positioned globally in the top dashboard area using fixed positioning to prevent layout shift.
 * - When connecting:
 *   🟠 Fetching Live Backend Data...
 *   Animated spinner + "Render server is waking up (may take up to 60 seconds)"
 * - When connected:
 *   🟢 Live Backend Connected (shown for 2 seconds, then smoothly hidden)
 * - Uses CSS transitions and lightweight keyframes only.
 */
export function BackendConnectingIndicator() {
  const [status, setStatus] = useState<BackendStatusType>(() => {
    if (typeof window === 'undefined') return 'idle';
    const initial = getBackendStatus();
    return initial === 'connecting' ? 'connecting' : initial === 'connected' ? 'connected' : 'idle';
  });

  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const initial = getBackendStatus();
    return initial === 'connecting' || initial === 'connected';
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let mounted = true;

    // Check status on mount
    const current = getBackendStatus();
    if (current === 'connecting') {
      setStatus('connecting');
      setVisible(true);
    }

    const handleStatus = (e: Event) => {
      const detail = (e as CustomEvent<{
        status?: BackendStatusType;
        wakingUp?: boolean;
        connected?: boolean;
        error?: boolean;
      }>).detail;

      if (!mounted || !detail) return;

      if (detail.status === 'connecting' || detail.wakingUp) {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
        setStatus('connecting');
        setVisible(true);
      } else if (detail.status === 'connected' || detail.connected) {
        setStatus('connected');
        setVisible(true);

        if (timerRef.current) clearTimeout(timerRef.current);
        if (exitTimerRef.current) clearTimeout(exitTimerRef.current);

        // Show green success pill for 2 seconds, then automatically hide
        timerRef.current = setTimeout(() => {
          if (!mounted) return;
          setVisible(false);
          exitTimerRef.current = setTimeout(() => {
            if (mounted) {
              setStatus('idle');
            }
          }, 350); // Matches CSS transition duration
        }, 2000);
      } else if (detail.status === 'error' || detail.error) {
        setVisible(false);
        if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
        exitTimerRef.current = setTimeout(() => {
          if (mounted) {
            setStatus('idle');
          }
        }, 350);
      }
    };

    window.addEventListener('backend-status', handleStatus);

    return () => {
      mounted = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      window.removeEventListener('backend-status', handleStatus);
    };
  }, []);

  if (status === 'idle') {
    return null;
  }

  const isConnecting = status === 'connecting';
  const isConnected = status === 'connected';

  return (
    <div
      className="fixed top-28 sm:top-32 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 ease-out max-w-[92vw]"
      style={{
        opacity: visible ? 1 : 0,
        transform: `translate(-50%, ${visible ? '0px' : '-8px'}) scale(${visible ? 1 : 0.96})`,
      }}
      aria-live="polite"
    >
      {isConnecting && (
        <div
          className="pointer-events-auto flex flex-col items-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl shadow-xl transition-all"
          style={{
            background: 'rgba(255, 251, 235, 0.96)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            boxShadow: '0 12px 36px -4px rgba(245, 158, 11, 0.18), 0 4px 12px rgba(0, 0, 0, 0.05)',
          }}
        >
          {/* Main Title Row */}
          <div className="flex items-center gap-2">
            <span className="text-sm">🟠</span>
            <span className="text-xs sm:text-sm font-bold text-amber-900 tracking-tight">
              Fetching Live Backend Data...
            </span>
          </div>

          {/* Subtitle with Animated Spinner */}
          <div className="flex items-center gap-2 text-[11px] sm:text-xs text-amber-800 font-medium text-center">
            <span
              className="w-3.5 h-3.5 rounded-full border-2 border-amber-600 border-t-transparent animate-spin inline-block flex-shrink-0"
              aria-label="Loading spinner"
            />
            <span>Render server is waking up (may take up to 60 seconds)</span>
          </div>
        </div>
      )}

      {isConnected && (
        <div
          className="pointer-events-auto flex items-center gap-2 px-4 sm:px-5 py-2 rounded-2xl shadow-xl transition-all"
          style={{
            background: 'rgba(240, 253, 244, 0.96)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            boxShadow: '0 12px 36px -4px rgba(16, 185, 129, 0.18), 0 4px 12px rgba(0, 0, 0, 0.05)',
          }}
        >
          <span className="text-sm">🟢</span>
          <span className="text-xs sm:text-sm font-bold text-emerald-900 tracking-tight">
            Live Backend Connected
          </span>
        </div>
      )}
    </div>
  );
}
