'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, MapPin, Building, Activity, RefreshCw } from 'lucide-react';
import { RpiHero } from '@/components/RPI/RpiHero';
import { ResourceRecommendation } from '@/components/RPI/ResourceRecommendation';
import { ModelTrustAtlas } from '@/components/RPI/ModelTrustAtlas';
import { RegionSelector } from '@/components/RegionSelector';
import { getRpiData, getAllRpiData } from '@/lib/api';
import { RpiData } from '@/types';

interface RpiPageProps {
  selectedCity?: string | null;
  onSelectCity?: (city: string) => void;
}

export function RpiPage({ selectedCity = 'Kanpur', onSelectCity }: RpiPageProps) {
  const [currentCity, setCurrentCity] = useState<string>(selectedCity || 'Kanpur');
  const [rpiData, setRpiData] = useState<RpiData | null>(null);
  const [stations, setStations] = useState<RpiData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Sync with prop when parent updates selectedCity
  useEffect(() => {
    if (selectedCity && selectedCity !== currentCity) {
      setCurrentCity(selectedCity);
    }
  }, [selectedCity]);

  // Load all stations once for Model Trust Atlas
  useEffect(() => {
    let mounted = true;
    getAllRpiData()
      .then((data) => {
        if (mounted && data && data.length > 0) {
          setStations(data);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch or calculate RPI data whenever currentCity changes
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    getRpiData(currentCity)
      .then((data) => {
        if (mounted && data) {
          setRpiData(data);
          setIsLoading(false);
          setIsRefreshing(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [currentCity]);

  const handleCitySelect = (city: string) => {
    setCurrentCity(city);
    if (onSelectCity) onSelectCity(city);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    getRpiData(currentCity)
      .then((data) => {
        setRpiData(data);
        setIsRefreshing(false);
      })
      .catch(() => setIsRefreshing(false));
  };

  return (
    <div className="space-y-7">
      {/* Top Emergency Operations Center Control Bar with Region Selector */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl bg-white/75 backdrop-blur-xl border border-slate-200/80 shadow-xs"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                RISK PRIORITY INDEX (RPI) MODULE
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Decision Support
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Disaster Risk Mitigation & Resource Pre-Positioning Dashboard for National & State EOCs
            </p>
          </div>
        </div>

        {/* Quick Station Navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-colors cursor-pointer"
            title="Refresh Synoptic RPI Run"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isRefreshing ? 'Recalculating...' : 'Refresh Index'}</span>
          </button>
        </div>
      </motion.div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Left Column: Section 1 Hero + Section 2 Recommendations + Section 3 Model Trust Atlas (12 or 8/4) */}
        <div className="lg:col-span-12 space-y-7">
          {/* Section 1 — Risk Priority Index Hero Card */}
          {isLoading || !rpiData ? (
            <div className="w-full h-72 rounded-2xl bg-slate-100/70 animate-pulse flex flex-col items-center justify-center text-slate-400 gap-3 border border-slate-200/60">
              <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              <span className="text-xs font-medium tracking-wide">
                Computing Risk Priority Index for {currentCity}...
              </span>
            </div>
          ) : (
            <motion.div
              key={rpiData.city}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <RpiHero rpiData={rpiData} />
            </motion.div>
          )}

          {/* Region Selector Bar for Smooth Country -> State -> District Exploration */}
          <div className="max-w-2xl">
            <RegionSelector selectedCity={currentCity} onSelectCity={handleCitySelect} />
          </div>

          {/* Section 2 — Resource Recommendation Engine */}
          {rpiData && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
            >
              <ResourceRecommendation rpiData={rpiData} />
            </motion.div>
          )}

          {/* Section 3 — Model Trust Atlas */}
          {rpiData && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 }}
            >
              <ModelTrustAtlas
                rpiData={rpiData}
                stations={stations.length > 0 ? stations : [rpiData]}
                onSelectCity={handleCitySelect}
              />
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
export default RpiPage;
