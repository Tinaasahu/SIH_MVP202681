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
import { RpiData, RpiPriority, HazardTierLevel, SEVERITY_PALETTE } from '@/types';

interface RpiHeroProps {
  rpiData: RpiData;
}

export function RpiHero({ rpiData }: RpiHeroProps) {
  const tier: HazardTierLevel =
    rpiData.tierLevel ||
    (rpiData.rpiScore >= 75 ? 'Red' : rpiData.rpiScore >= 56 ? 'Orange' : rpiData.rpiScore >= 31 ? 'Yellow' : 'Green');
  const palette = SEVERITY_PALETTE[tier];

  // SVG Circular Ring geometry
  const radius = 68;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, rpiData.rpiScore)) / 100) * circumference;

  return (
    <GlassCard padding="lg" variant="blue" className="relative overflow-hidden">
      {/* Top Government EOC Banner */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b"
        style={{ borderColor: 'var(--glass-border, rgba(220, 225, 255, 0.14))' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-400/20 flex items-center justify-center text-sky-400 shadow-xs">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-bold tracking-widest uppercase"
                style={{ letterSpacing: '0.12em', color: 'var(--text-primary, #F3F5FA)' }}
              >
                GOVERNMENT EMERGENCY OPERATIONS CENTER (EOC)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-400/30">
                MoES / NDMA Module
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs mt-0.5" style={{ color: 'var(--text-muted, #747F9C)' }}>
              <span>National Disaster Decision Support Framework</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-sky-400" />
                Live 24h Synoptic Horizon
              </span>
            </div>
          </div>
        </div>

        {/* EOC Readiness Badge */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderColor: 'var(--glass-border, rgba(220, 225, 255, 0.14))',
            color: 'var(--text-primary, #F3F5FA)',
          }}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Automated Risk Scoring Active</span>
        </div>
      </div>

      {/* Main Hero Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mt-6">
        {/* Left Side: Station Identity & RPI Summary (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div>
            <span
              className="text-[11px] font-bold uppercase tracking-wider block mb-1"
              style={{ color: 'var(--text-muted, #747F9C)' }}
            >
              TARGET SYNOPTIC OBSERVATION STATION
            </span>
            <div className="flex items-baseline gap-2.5">
              <h1
                className="text-3xl sm:text-4xl font-extrabold tracking-tight drop-shadow-sm"
                style={{ color: 'var(--text-primary, #F3F5FA)' }}
              >
                {rpiData.city}
              </h1>
              <span
                className="text-sm font-semibold"
                style={{ color: 'var(--text-secondary, #A9B2C8)' }}
              >
                · {rpiData.state}
              </span>
            </div>
          </div>

          {/* Universal Hazard Tier Badge & Red-only Confidence Badge */}
          <div className="flex flex-wrap items-center gap-2">
            <motion.div
              layout
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${palette.bgBadge} ${palette.textBadge} ${palette.borderBadge}`}
              style={{ boxShadow: `0 0 16px ${palette.glow}` }}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{rpiData.actionTier || palette.label}</span>
            </motion.div>

            {/* Step 3: Confidence Badge ONLY shown when Tier == Red */}
            {tier === 'Red' && (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border shadow-xs ${
                  rpiData.confidence >= 70
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {rpiData.confidence >= 70
                  ? 'High Confidence — Immediate Action'
                  : 'Low Confidence — Verify Before Escalating'}
              </span>
            )}
          </div>

          <p
            className="text-xs leading-relaxed font-medium"
            style={{ color: 'var(--text-secondary, #A9B2C8)' }}
          >
            {palette.sublabel}. Physical hazard severity is independently decoupled from NWP consensus confidence to eliminate hazard dilution.
          </p>

          {/* Action Directive Banner */}
          {rpiData.actionDirective && (
            <div
              className="px-3.5 py-2.5 rounded-xl text-[11.5px] font-semibold flex items-center gap-2.5 shadow-sm border"
              style={{
                background: 'rgba(5, 8, 23, 0.75)',
                borderColor: 'var(--glass-border, rgba(220, 225, 255, 0.14))',
                color: 'var(--text-primary, #F3F5FA)',
              }}
            >
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="leading-snug">
                <span className="text-slate-400 font-mono text-[9.5px] uppercase tracking-wider block">Operational Action Directive:</span>
                <span style={{ color: 'var(--text-primary, #F3F5FA)' }} className="font-bold">{rpiData.actionDirective}</span>
              </div>
            </div>
          )}

          {/* RPI Formula Reference Banner */}
          <div
            className="p-3 rounded-xl border text-[11px] leading-snug"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              borderColor: 'var(--glass-border, rgba(220, 225, 255, 0.14))',
              color: 'var(--text-secondary, #A9B2C8)',
            }}
          >
            <div className="font-bold text-[10.5px] uppercase tracking-wider mb-1 flex items-center gap-1.5" style={{ color: 'var(--text-primary, #F3F5FA)' }}>
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <span>Decoupled Sendai / NDMA Operational Formula:</span>
            </div>
            <code
              className="font-mono text-[10px] block px-2 py-1 rounded border font-semibold"
              style={{
                background: 'rgba(0, 0, 0, 0.35)',
                borderColor: 'rgba(255, 255, 255, 0.08)',
                color: 'var(--text-primary, #F3F5FA)',
              }}
            >
              Hazard = 70% Max(Hazard) + 30% Mean(Hazards) · Confidence Gates Red Action
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
                stroke="currentColor"
                className="text-slate-200 dark:text-white/15"
                style={{ stroke: 'rgba(255, 255, 255, 0.15)' }}
                strokeWidth={strokeWidth}
                fill="none"
              />
              {/* Animated Progress Ring with Shared Severity Palette */}
              <motion.circle
                cx="80"
                cy="80"
                r={radius}
                stroke={palette.strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeLinecap="round"
                fill="none"
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                style={{ filter: `drop-shadow(0 0 8px ${palette.strokeColor})` }}
              />
            </svg>

            {/* Inner Center Score Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span
                className="text-[10px] font-extrabold uppercase tracking-widest"
                style={{ color: 'var(--text-secondary, #A9B2C8)' }}
              >
                RPI INDEX
              </span>
              <motion.span
                key={rpiData.rpiScore}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-4xl sm:text-5xl font-black leading-none my-1 tracking-tight drop-shadow-md"
                style={{
                  color: 'var(--text-primary, #FFFFFF)',
                  textShadow: '0 2px 14px rgba(0, 0, 0, 0.65)',
                }}
              >
                {rpiData.rpiScore}
              </motion.span>
              <span
                className="text-[11px] font-bold"
                style={{ color: 'var(--text-muted, #747F9C)' }}
              >
                / 100
              </span>
            </div>
          </div>
          <span
            className="text-xs font-semibold mt-2"
            style={{ color: 'var(--text-secondary, #A9B2C8)' }}
          >
            Hazard Index: <strong style={{ color: palette.strokeColor }}>{palette.name.toUpperCase()} ({rpiData.priority})</strong>
          </span>
        </div>

        {/* Right Side: Key Synoptic Risk Factors & Decomposition (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <span
            className="text-[11px] font-bold uppercase tracking-wider block mb-1"
            style={{ color: 'var(--text-muted, #747F9C)' }}
          >
            HAZARD RISK DECOMPOSITION
          </span>

          {/* 1. Rainfall Metric */}
          <div
            className="p-3 rounded-xl border shadow-xs"
            style={{
              background: 'var(--card-sub-bg, rgba(15, 21, 45, 0.55))',
              borderColor: 'var(--card-sub-border, rgba(220, 225, 255, 0.12))',
            }}
          >
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary, #F3F5FA)' }}>
                <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                Rainfall (35% wt)
              </span>
              <span className="font-bold font-mono" style={{ color: 'var(--text-primary, #F3F5FA)' }}>
                {rpiData.rainfall} mm <span style={{ color: 'var(--text-muted, #747F9C)' }} className="font-normal">({rpiData.rainRisk}%)</span>
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.08)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${rpiData.rainRisk}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full bg-sky-500"
              />
            </div>
          </div>

          {/* 2. Temperature Metric */}
          <div
            className="p-3 rounded-xl border shadow-xs"
            style={{
              background: 'var(--card-sub-bg, rgba(15, 21, 45, 0.55))',
              borderColor: 'var(--card-sub-border, rgba(220, 225, 255, 0.12))',
            }}
          >
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary, #F3F5FA)' }}>
                <Thermometer className="w-3.5 h-3.5 text-orange-400" />
                Temperature (25% wt)
              </span>
              <span className="font-bold font-mono" style={{ color: 'var(--text-primary, #F3F5FA)' }}>
                {rpiData.temperature}°C <span style={{ color: 'var(--text-muted, #747F9C)' }} className="font-normal">({rpiData.heatRisk}%)</span>
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.08)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${rpiData.heatRisk}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.05 }}
                className="h-full rounded-full bg-orange-500"
              />
            </div>
          </div>

          {/* 3. Wind Metric */}
          <div
            className="p-3 rounded-xl border shadow-xs"
            style={{
              background: 'var(--card-sub-bg, rgba(15, 21, 45, 0.55))',
              borderColor: 'var(--card-sub-border, rgba(220, 225, 255, 0.12))',
            }}
          >
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary, #F3F5FA)' }}>
                <Wind className="w-3.5 h-3.5 text-purple-400" />
                Wind Velocity (20% wt)
              </span>
              <span className="font-bold font-mono" style={{ color: 'var(--text-primary, #F3F5FA)' }}>
                {rpiData.wind} km/h <span style={{ color: 'var(--text-muted, #747F9C)' }} className="font-normal">({rpiData.windRisk}%)</span>
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.08)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${rpiData.windRisk}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                className="h-full rounded-full bg-purple-500"
              />
            </div>
          </div>

          {/* 4. Confidence Metric */}
          <div
            className="p-3 rounded-xl border shadow-xs"
            style={{
              background: 'var(--card-sub-bg, rgba(15, 21, 45, 0.55))',
              borderColor: 'var(--card-sub-border, rgba(220, 225, 255, 0.12))',
            }}
          >
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary, #F3F5FA)' }}>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Confidence (20% wt)
              </span>
              <span className="font-bold font-mono" style={{ color: 'var(--text-primary, #F3F5FA)' }}>
                {rpiData.confidence}% <span style={{ color: 'var(--text-muted, #747F9C)' }} className="font-normal">Reliability</span>
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.08)' }}>
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
