'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  Droplets,
  Flame,
  Wind,
  Home,
  Waves,
  Truck,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Send,
  Sparkles,
  Info,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { ResourceAction, RpiData } from '@/types';

interface ResourceRecommendationProps {
  rpiData: RpiData;
}

const CATEGORY_TABS = [
  { id: 'all', label: 'All Protocols', icon: ShieldAlert },
  { id: 'rain', label: 'Flood & Rain', icon: Droplets },
  { id: 'heat', label: 'Heat Action Plan', icon: Flame },
  { id: 'wind', label: 'Wind & Infrastructure', icon: Wind },
];

export function ResourceRecommendation({ rpiData }: ResourceRecommendationProps) {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [dispatchedIds, setDispatchedIds] = useState<Set<string>>(new Set());

  const filteredRecs = rpiData.recommendations.filter(
    (r) => activeTab === 'all' || r.category === activeTab || (activeTab === 'rain' && r.category === 'general')
  );

  const handleDispatch = (id: string) => {
    setDispatchedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'rain':
        return <Waves className="w-4 h-4 text-sky-500" />;
      case 'heat':
        return <Flame className="w-4 h-4 text-orange-500" />;
      case 'wind':
        return <Wind className="w-4 h-4 text-purple-500" />;
      default:
        return <Building2 className="w-4 h-4 text-blue-500" />;
    }
  };

  const getPriorityBadgeVariant = (priority: string): 'danger' | 'warning' | 'info' | 'success' => {
    switch (priority) {
      case 'critical':
        return 'danger';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      default:
        return 'success';
    }
  };

  return (
    <GlassCard padding="lg" variant="default" className="relative overflow-hidden">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-600 border border-blue-500/20">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-wider text-slate-800 uppercase">
                  RESOURCE RECOMMENDATION ENGINE
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 border border-amber-500/30">
                  Govt EOC Active
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Dynamic SOP Action Cards triggered by live synoptic risk indicators for{' '}
                <span className="font-semibold text-slate-700">{rpiData.city}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Category filter tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100/80 border border-slate-200/70">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Trigger rule condition banner */}
      <div className="mt-4 mb-5 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-600">
          <Info className="w-4 h-4 text-blue-500 shrink-0" />
          <span>
            <strong className="text-slate-700 font-semibold">Active Risk Drivers:</strong>{' '}
            Rainfall <strong className="text-slate-800">{rpiData.rainfall} mm</strong> (Risk: {rpiData.rainRisk}%) · Temp{' '}
            <strong className="text-slate-800">{rpiData.temperature}°C</strong> (Risk: {rpiData.heatRisk}%) · Wind{' '}
            <strong className="text-slate-800">{rpiData.wind} km/h</strong> (Risk: {rpiData.windRisk}%)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500">Auto-Dispatched:</span>
          <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 text-[11px]">
            {dispatchedIds.size} / {rpiData.recommendations.length} Orders
          </span>
        </div>
      </div>

      {/* Grid of Action Cards with Framer Motion hover elevation */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredRecs.map((rec, index) => {
            const isDispatched = dispatchedIds.has(rec.id);
            return (
              <motion.div
                key={rec.id}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.28, delay: index * 0.05 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className={`relative rounded-2xl p-4.5 border transition-colors flex flex-col justify-between ${
                  isDispatched
                    ? 'bg-emerald-50/50 border-emerald-300 shadow-sm'
                    : 'bg-white/80 backdrop-blur-md border-slate-200/80 hover:border-blue-300 hover:shadow-md'
                }`}
              >
                <div>
                  {/* Top Bar: Action Code & Priority Badge */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="p-1 rounded-md bg-slate-100 text-slate-600">
                        {getCategoryIcon(rec.category)}
                      </span>
                      <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 bg-slate-100/90 px-1.5 py-0.5 rounded border border-slate-200/60">
                        {rec.actionCode}
                      </span>
                    </div>

                    <Badge variant={getPriorityBadgeVariant(rec.priority)}>
                      {rec.priority.toUpperCase()}
                    </Badge>
                  </div>

                  {/* Title */}
                  <h4 className="text-sm font-bold text-slate-800 leading-snug mb-2">
                    {rec.title}
                  </h4>

                  {/* Description */}
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    {rec.description}
                  </p>
                </div>

                {/* Footer Bar: Department & Operational Dispatch Button */}
                <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="truncate max-w-[200px]" title={rec.department}>
                      🏛️ {rec.department}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isDispatched
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isDispatched ? 'DISPATCHED' : rec.status}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDispatch(rec.id)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isDispatched
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                        : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-sm'
                    }`}
                  >
                    {isDispatched ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Order Mobilized</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Dispatch Resource</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </GlassCard>
  );
}
export default ResourceRecommendation;
