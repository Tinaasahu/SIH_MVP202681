import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number, decimals = 1): string {
  return value.toFixed(decimals);
}

export function getRiskColor(risk: string): string {
  switch (risk) {
    case 'severe': return '#ef4444';
    case 'high': return '#f97316';
    case 'moderate': return '#f59e0b';
    case 'low': return '#10b981';
    default: return '#94a3b8';
  }
}

export function getRiskBg(risk: string): string {
  switch (risk) {
    case 'severe': return 'rgba(239,68,68,0.08)';
    case 'high': return 'rgba(249,115,22,0.08)';
    case 'moderate': return 'rgba(245,158,11,0.08)';
    case 'low': return 'rgba(16,185,129,0.08)';
    default: return 'rgba(148,163,184,0.08)';
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'healthy': return '#10b981';
    case 'delayed': return '#f59e0b';
    case 'unavailable': return '#ef4444';
    default: return '#94a3b8';
  }
}

export function interpolate(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}
