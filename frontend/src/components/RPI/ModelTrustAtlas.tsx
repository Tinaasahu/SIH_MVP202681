'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import {
  Layers,
  MapPin,
  Cpu,
  TrendingUp,
  Percent,
  CheckCircle,
  BarChart2,
  Sliders,
  ShieldCheck,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { RpiData } from '@/types';

// Dynamic import with SSR disabled for Leaflet
const RealTrustAtlasMap = dynamic(() => import('./RealTrustAtlasMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[540px] rounded-2xl bg-slate-100/60 animate-pulse flex flex-col items-center justify-center text-slate-400 gap-3 border border-slate-200/60">
      <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      <span className="text-xs font-medium tracking-wide">Loading Real Geographic Model Trust Atlas...</span>
    </div>
  ),
});

interface ModelTrustAtlasProps {
  rpiData: RpiData;
  stations: RpiData[];
  onSelectCity: (city: string) => void;
}

const MODEL_COLOR_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; hex: string; desc: string }
> = {
  ECMWF: {
    label: 'ECMWF IFS',
    bg: 'bg-blue-500',
    text: 'text-blue-600',
    hex: '#2563eb',
    desc: 'European Centre for Medium-Range Weather Forecasts (Primary Precipitation Bias Weight)',
  },
  ICON: {
    label: 'ICON Seamless',
    bg: 'bg-emerald-500',
    text: 'text-emerald-600',
    hex: '#10b981',
    desc: 'German Weather Service (High Convective & Thermal Precision)',
  },
  GFS: {
    label: 'GFS Global',
    bg: 'bg-purple-500',
    text: 'text-purple-600',
    hex: '#8b5cf6',
    desc: 'NOAA NCEP (Synoptic Circulation & Jet Stream Boundary Tracking)',
  },
  GEM: {
    label: 'GEM Canada',
    bg: 'bg-orange-500',
    text: 'text-orange-600',
    hex: '#f97316',
    desc: 'Environment and Climate Change Canada (Surface Temperature & Dewpoint)',
  },
};

export function ModelTrustAtlas({ rpiData, stations, onSelectCity }: ModelTrustAtlasProps) {
  const domModel = (rpiData.dominantModel || 'ECMWF').toUpperCase();
  const modelInfo = MODEL_COLOR_CONFIG[domModel] || MODEL_COLOR_CONFIG['ECMWF'];
  const weights = rpiData.modelWeights || { ecmwf: 45, icon: 25, gfs: 18, gem: 12 };

  return (
    <GlassCard padding="lg" variant="default" className="relative overflow-hidden">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-5 border-b border-slate-200/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-600/10 flex items-center justify-center text-purple-600 border border-purple-500/20">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-wider text-slate-800 uppercase">
                MODEL TRUST ATLAS (NATIONAL CARTOGRAPHY)
              </h3>
              <Badge variant="info">AI Adaptive NWP Blending</Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Station markers dynamically color-coded by the historically highest-performing NWP model in each synoptic zone
            </p>
          </div>
        </div>

        {/* Quick status pill */}
        <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
          <MapPin size={13} className="text-blue-600" />
          <span>
            Active Station: <strong className="text-slate-900">{rpiData.city}</strong> ({rpiData.state})
          </span>
        </div>
      </div>

      {/* Main Grid: Leaflet Map (Left 8 cols) + Adaptive Model Weights & Trust Telemetry (Right 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-start">
        {/* Leaflet Trust Atlas Map (8 Cols) */}
        <div className="lg:col-span-8">
          <RealTrustAtlasMap
            stations={stations}
            selectedCity={rpiData.city}
            onSelectCity={onSelectCity}
          />
        </div>

        {/* Model Trust & Adaptive Weights Telemetry (4 Cols) */}
        <motion.div
          key={rpiData.city}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="lg:col-span-4 space-y-4"
        >
          {/* Dominant Model Card */}
          <div className="rounded-2xl p-5 bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-700 tracking-wider uppercase">
                  DOMINANT MODEL
                </span>
              </div>
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white shadow-xs"
                style={{ backgroundColor: modelInfo.hex }}
              >
                {domModel} LEADS
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm text-slate-900">{modelInfo.label}</span>
                <span className="text-xs font-mono font-bold" style={{ color: modelInfo.hex }}>
                  {weights[domModel.toLowerCase() as keyof typeof weights] || 45}% Weight
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">{modelInfo.desc}</p>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 text-slate-600">
              <span>Station Confidence:</span>
              <strong className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/70">
                {rpiData.confidence}% Reliability
              </strong>
            </div>
          </div>

          {/* Adaptive Weight Percentages (Live Blending Mix) */}
          <div className="rounded-2xl p-5 bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-bold text-slate-700 tracking-wider uppercase">
                  ADAPTIVE BLEND WEIGHTS
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Dynamic Kalman Tuning</span>
            </div>

            <div className="space-y-3.5">
              {/* ECMWF Bar */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    ECMWF IFS (Europe)
                  </span>
                  <span className="font-mono font-bold text-blue-700">{weights.ecmwf}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${weights.ecmwf}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full rounded-full bg-blue-600"
                  />
                </div>
              </div>

              {/* ICON Bar */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    ICON Seamless (Germany)
                  </span>
                  <span className="font-mono font-bold text-emerald-700">{weights.icon}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${weights.icon}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
                    className="h-full rounded-full bg-emerald-500"
                  />
                </div>
              </div>

              {/* GFS Bar */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    GFS Global (NOAA USA)
                  </span>
                  <span className="font-mono font-bold text-purple-700">{weights.gfs}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${weights.gfs}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                    className="h-full rounded-full bg-purple-500"
                  />
                </div>
              </div>

              {/* GEM Bar */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                    GEM Seamless (Canada)
                  </span>
                  <span className="font-mono font-bold text-orange-700">{weights.gem}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${weights.gem}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
                    className="h-full rounded-full bg-orange-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Weights Total:</span>
              <strong className="font-mono text-slate-800 font-bold">100% Normalized</strong>
            </div>
          </div>

          {/* Operational Verification Checklist */}
          <div className="rounded-2xl p-4 bg-slate-50/90 border border-slate-200/80 text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-[11px] uppercase tracking-wider">
              <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
              <span>Multi-Model Verification Status</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              The AI blend dynamically reallocates weights each synoptic run (00Z, 06Z, 12Z, 18Z). Station weights update automatically when selecting any district marker on the map.
            </p>
          </div>
        </motion.div>
      </div>
    </GlassCard>
  );
}
export default ModelTrustAtlas;
