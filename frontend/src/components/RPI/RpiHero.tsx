'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  ShieldAlert,
  AlertTriangle,
  CloudRain,
  Thermometer,
  Wind,
  CheckCircle2,
  Activity,
  Layers,
  Sparkles,
  Building2,
  Calendar,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { RpiData, RpiPriority } from '@/types';

interface RpiHeroProps {
  rpiData: RpiData;
}

const PRIORITY_CONFIG: Record<
  RpiPriority,
  {
    label: string;
    sublabel: string;
    strokeColor: string;
    bgBadge: string;
    textBadge: string;
    borderBadge: string;
    glow: string;
  }
> = {
  Low: {
    label: 'LOW RISK',
    sublabel: 'Routine Surveillance · All Parameters Normal',
    strokeColor: '#10b981',
    bgBadge: 'bg-emerald-500/15',
    textBadge: 'text-emerald-700',
    borderBadge: 'border-emerald-500/30',
    glow: 'rgba(16, 185, 129, 0.25)',
  },
  Moderate: {
    label: 'MODERATE RISK',
    sublabel: 'Heightened Watch · Localized Mitigation Standby',
    strokeColor: '#f59e0b',
    bgBadge: 'bg-amber-500/15',
    textBadge: 'text-amber-700',
    borderBadge: 'border-amber-500/30',
    glow: 'rgba(245, 158, 11, 0.25)',
  },
  High: {
    label: 'HIGH RISK',
    sublabel: 'Urgent Action Mandated · Field Units Mobilized',
    strokeColor: '#f97316',
    bgBadge: 'bg-orange-500/15',
    textBadge: 'text-orange-700',
    borderBadge: 'border-orange-500/30',
    glow: 'rgba(249, 115, 22, 0.3)',
  },
  Critical: {
    label: 'CRITICAL EMERGENCY',
    sublabel: 'Tier-1 Emergency · SDRF Pre-Positioning Active',
    strokeColor: '#ef4444',
    bgBadge: 'bg-red-500/20',
    textBadge: 'text-red-700',
    borderBadge: 'border-red-500/40',
    glow: 'rgba(239, 68, 68, 0.35)',
  },
};

export function RpiHero({ rpiData }: RpiHeroProps) {
  const priorityInfo = PRIORITY_CONFIG[rpiData.priority] || PRIORITY_CONFIG['Low'];

  // SVG Circular Ring geometry
  const radius = 68;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, rpiData.rpiScore)) / 100) * circumference;

  return (
    <GlassCard padding="lg" variant="blue" className="relative overflow-hidden">
      {/* Top Government EOC Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200/70">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-600 shadow-xs">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-widest text-slate-800 uppercase" style={{ letterSpacing: '0.12em' }}>
                GOVERNMENT EMERGENCY OPERATIONS CENTER (EOC)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                MoES / NDMA Module
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span>National Disaster Decision Support Framework</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                Live 24h Synoptic Horizon
              </span>
            </div>
          </div>
        </div>

        {/* EOC Readiness Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-700">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Automated Risk Scoring Active</span>
        </div>
      </div>

      {/* Main Hero Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mt-6">
        {/* Left Side: Station Identity & RPI Summary (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              TARGET synoptic OBSERVATION STATION
            </span>
            <div className="flex items-baseline gap-2.5">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                {rpiData.city}
              </h1>
              <span className="text-sm font-semibold text-slate-500">· {rpiData.state}</span>
            </div>
          </div>

          {/* Priority Badge with Framer Motion color transition */}
          <motion.div
            layout
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${priorityInfo.bgBadge} ${priorityInfo.textBadge} ${priorityInfo.borderBadge}`}
            style={{ boxShadow: `0 0 16px ${priorityInfo.glow}` }}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{priorityInfo.label}</span>
          </motion.div>

          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            {priorityInfo.sublabel}. RPI synthesizes multi-hazard meteorological severity with numerical weather prediction confidence scores.
          </p>

          {/* RPI Formula Reference Banner */}
          <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/80 text-[11px] text-slate-600 leading-snug">
            <div className="font-bold text-slate-700 text-[10.5px] uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-600" />
              <span>Standard Operational Formula:</span>
            </div>
            <code className="text-slate-800 font-mono text-[10.5px] block bg-white px-2 py-1 rounded border border-slate-200/60 font-semibold">
              RPI = 35% Rain + 25% Heat + 20% Wind + 20% Confidence
            </code>
          </div>
        </div>

        {/* Center: Circular Progress Indicator with Framer Motion (3 Cols) */}
        <div className="lg:col-span-3 flex flex-col items-center justify-center py-2">
          <div className="relative w-44 h-44 flex items-center justify-center">
            {/* Background SVG Circle Ring */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
              <circle
                cx="80"
                cy="80"
                r={radius}
                stroke="#e2e8f0"
                strokeWidth={strokeWidth}
                fill="none"
              />
              {/* Animated Progress Ring */}
              <motion.circle
                cx="80"
                cy="80"
                r={radius}
                stroke={priorityInfo.strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeLinecap="round"
                fill="none"
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                style={{ filter: `drop-shadow(0 0 6px ${priorityInfo.strokeColor})` }}
              />
            </svg>

            {/* Inner Center Score Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                RPI INDEX
              </span>
              <motion.span
                key={rpiData.rpiScore}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-4xl font-black text-slate-900 leading-none my-0.5"
              >
                {rpiData.rpiScore}
              </motion.span>
              <span className="text-[11px] font-bold text-slate-500">
                / 100
              </span>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-600 mt-2">
            Priority Index: <strong style={{ color: priorityInfo.strokeColor }}>{rpiData.priority}</strong>
          </span>
        </div>

        {/* Right Side: Key Synoptic Risk Factors & Decomposition (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            HAZARD RISK DECOMPOSITION
          </span>

          {/* 1. Rainfall Metric */}
          <div className="p-3 rounded-xl bg-white/80 border border-slate-200/80 shadow-xs">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <CloudRain className="w-3.5 h-3.5 text-sky-600" />
                Rainfall (35% wt)
              </span>
              <span className="font-bold text-slate-900 font-mono">
                {rpiData.rainfall} mm <span className="text-slate-400 font-normal">({rpiData.rainRisk}%)</span>
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${rpiData.rainRisk}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full bg-sky-500"
              />
            </div>
          </div>

          {/* 2. Temperature Metric */}
          <div className="p-3 rounded-xl bg-white/80 border border-slate-200/80 shadow-xs">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5 text-orange-500" />
                Temperature (25% wt)
              </span>
              <span className="font-bold text-slate-900 font-mono">
                {rpiData.temperature}°C <span className="text-slate-400 font-normal">({rpiData.heatRisk}%)</span>
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${rpiData.heatRisk}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.05 }}
                className="h-full rounded-full bg-orange-500"
              />
            </div>
          </div>

          {/* 3. Wind Metric */}
          <div className="p-3 rounded-xl bg-white/80 border border-slate-200/80 shadow-xs">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-purple-500" />
                Wind Velocity (20% wt)
              </span>
              <span className="font-bold text-slate-900 font-mono">
                {rpiData.wind} km/h <span className="text-slate-400 font-normal">({rpiData.windRisk}%)</span>
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${rpiData.windRisk}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                className="h-full rounded-full bg-purple-500"
              />
            </div>
          </div>

          {/* 4. Confidence Metric */}
          <div className="p-3 rounded-xl bg-white/80 border border-slate-200/80 shadow-xs">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Confidence (20% wt)
              </span>
              <span className="font-bold text-slate-900 font-mono">
                {rpiData.confidence}% <span className="text-slate-400 font-normal">Reliability</span>
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${rpiData.confidence}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
                className="h-full rounded-full bg-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
export default RpiHero;
