'use client';
import { useState, useEffect } from 'react';
import { AtmosphereLayer, AtmosphereTheme } from '@/components/AtmosphereLayer';
import { SimpleMinimalistUI } from '@/components/SimpleMinimalistUI';
import { Header } from '@/components/Header';
import { BackendConnectingIndicator } from '@/components/BackendConnectingIndicator';
import { StatusStrip } from '@/components/StatusStrip';
import { CursorEffect } from '@/components/CursorEffect';
import { ForecastHero } from '@/components/ForecastHero';
import { ModelContribution } from '@/components/ModelContribution';
import { ForecastTimeline } from '@/components/ForecastTimeline';
import { ExtremeWeatherPanel } from '@/components/ExtremeWeather';
import { ModelSkillPanel } from '@/components/ModelSkill';
import { DataHealthPanel } from '@/components/DataHealth';
import { WeatherMap } from '@/components/WeatherMap';
import { RegionSelector } from '@/components/RegionSelector';
import { ModelComparison } from '@/components/ModelComparison';
import { ForecastPage } from '@/components/pages/ForecastPage';
import { ModelIntelligencePage } from '@/components/pages/ModelIntelligencePage';
import { ExtremeWeatherPage } from '@/components/pages/ExtremeWeatherPage';
import { ModelPerformancePage } from '@/components/pages/ModelPerformancePage';
import { DataHealthPage } from '@/components/pages/DataHealthPage';
import { RpiPage } from '@/components/pages/RpiPage';
import { NavPage, CityForecast } from '@/types';
import { getForecastMetrics, getAlerts } from '@/lib/api';
import { EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Home() {
  const [currentPage, setCurrentPage] = useState<NavPage>('overview');
  const [selectedCity, setSelectedCity] = useState<string | null>('Kanpur');
  const [isScenicMode, setIsScenicMode] = useState(false);
  const [themeMode, setThemeMode] = useState<AtmosphereTheme | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('nabhdrishti-theme-mode');
      if (saved === 'simple') {
        setThemeMode('simple');
      }
    } catch {}
  }, []);

  const [atmoWeather, setAtmoWeather] = useState<{
    condition: string;
    rainfall: number;
    temperature: number;
    wind: number;
    alert_type?: string;
  }>({
    condition: 'clear',
    rainfall: 0,
    temperature: 28,
    wind: 12,
    alert_type: undefined,
  });

  useEffect(() => {
    let mounted = true;
    const city = selectedCity || 'Kanpur';
    Promise.all([
      getForecastMetrics(city),
      getAlerts(city),
    ]).then(([metrics, alerts]) => {
      if (!mounted) return;
      const stormAlert = alerts?.find(a => 
        a.event.toLowerCase().includes('storm') || 
        (a.event.toLowerCase().includes('wind') && a.severity.toLowerCase() === 'high')
      );
      const isRain = metrics.rainfall > 10;
      const isHeatwave = metrics.temperature >= 38;
      const isCloudy = metrics.rainfall > 1 || metrics.wind > 20;
      const cond = isRain ? 'rain' : isHeatwave ? 'heatwave' : isCloudy ? 'cloudy' : 'clear';

      setAtmoWeather({
        condition: cond,
        rainfall: metrics.rainfall,
        temperature: metrics.temperature,
        wind: metrics.wind,
        alert_type: stormAlert ? 'storm' : undefined,
      });
    }).catch(() => {});

    return () => {
      mounted = false;
    };
  }, [selectedCity]);

  const handleCitySelect = (city: CityForecast | string) => {
    const cityName = typeof city === 'string' ? city : city.city;
    setSelectedCity(cityName);
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'forecast':
        return <ForecastPage selectedCity={selectedCity} onSelectCity={handleCitySelect} />;
      case 'model-intelligence':
        return <ModelIntelligencePage />;
      case 'extreme-weather':
        return <ExtremeWeatherPage />;
      case 'rpi':
        return <RpiPage selectedCity={selectedCity} onSelectCity={handleCitySelect} />;
      case 'model-performance':
        return <ModelPerformancePage />;
      case 'data-health':
        return <DataHealthPage />;
      case 'overview':
      default:
        return (
          <div className="space-y-6">
            {/* Top Forecast Decision Hero */}
            <ForecastHero selectedCity={selectedCity} />

            {/* Core Operational Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column (Primary Visualizations) - 7 cols */}
              <div className="lg:col-span-7 space-y-6">
                <WeatherMap
                  selectedCity={selectedCity}
                  onSelectCity={handleCitySelect}
                />
                <ForecastTimeline selectedCity={selectedCity} />
                
                {/* 2-Column Equal Height Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ModelComparison selectedCity={selectedCity} />
                  <ExtremeWeatherPanel selectedCity={selectedCity} />
                </div>
              </div>

              {/* Right Column (Controls & Deep Intelligence) - 5 cols */}
              <div className="lg:col-span-5 space-y-6">
                <RegionSelector selectedCity={selectedCity} onSelectCity={handleCitySelect} />
                <ModelContribution selectedCity={selectedCity} />
                <ModelSkillPanel />
                <DataHealthPanel />
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={cn("relative min-h-screen overflow-x-hidden", themeMode === 'simple' ? "bg-[#f6f7f9]" : "atmo-bg")}>
      {/* Context-Aware Atmospheric Background Layer */}
      <AtmosphereLayer
        condition={atmoWeather.condition}
        rainfall={atmoWeather.rainfall}
        temperature={atmoWeather.temperature}
        wind={atmoWeather.wind}
        alert_type={atmoWeather.alert_type}
        themeMode={themeMode}
        onThemeChange={(t) => {
          setThemeMode(t);
          if (t) {
            try { localStorage.setItem('nabhdrishti-theme-mode', t); } catch {}
          } else {
            try { localStorage.removeItem('nabhdrishti-theme-mode'); } catch {}
          }
        }}
      />

      {/* Under-Lightning Electric Cursor (Active only in atmospheric mode) */}
      <CursorEffect enabled={themeMode !== 'simple'} />

      {themeMode === 'simple' ? (
        /* Government UI Concept: Simple Minimalist Light Theme */
        <SimpleMinimalistUI
          selectedCity={selectedCity || 'Kanpur'}
          onSelectCity={handleCitySelect}
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          onSwitchAtmosphere={() => {
            setThemeMode(null);
            try { localStorage.removeItem('nabhdrishti-theme-mode'); } catch {}
          }}
          renderOtherPage={renderContent}
        />
      ) : (
        /* Cinematic Atmospheric Glassmorphic Dashboard */
        <>
          {/* Floating Boxed Taskbar Panel */}
          <Header
            currentPage={currentPage}
            onNavigate={setCurrentPage}
            isScenicMode={isScenicMode}
            onToggleScenic={() => setIsScenicMode(!isScenicMode)}
          />

          {/* Global Backend Connecting / Cold Start Indicator */}
          <BackendConnectingIndicator />

          {/* Main Content with generous top padding & smooth Scenic View fade */}
          <main
            onClick={() => {
              if (isScenicMode) setIsScenicMode(false);
            }}
            className={cn(
              "relative z-10 max-w-[1440px] mx-auto px-4 sm:px-6 pt-36 pb-20 transition-all duration-500",
              isScenicMode ? "opacity-10 scale-[0.99] pointer-events-none filter blur-[0.5px]" : "opacity-100 scale-100"
            )}
          >
            <StatusStrip />
            {renderContent()}
          </main>

          {/* Scenic View Floating Dismiss Banner */}
          {isScenicMode && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-bounce">
              <button
                type="button"
                onClick={() => setIsScenicMode(false)}
                className="px-5 py-2.5 rounded-full bg-slate-900/90 text-white text-xs font-bold tracking-wide backdrop-blur-xl border border-white/20 shadow-2xl flex items-center gap-2 hover:bg-slate-900 hover:scale-105 transition-all cursor-pointer"
              >
                <EyeOff size={15} className="text-amber-400" />
                <span>Click Anywhere to Return to Dashboard</span>
              </button>
            </div>
          )}

          {/* Enterprise Scientific Footer */}
          <footer
            className="relative z-10 max-w-[1440px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#A9B2C8]"
            style={{ borderTop: '1px solid rgba(220, 225, 255, 0.08)' }}
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <img src="/logo-emblem.png" alt="नभदृष्टि Logo" className="w-5 h-5 object-contain rounded" />
              <span className="font-bold text-[#F3F5FA]">नभदृष्टि Hybrid AI–NWP Platform</span>
              <span>·</span>
              <span>MoES / NCMRWF</span>
              <span>·</span>
              <span>Smart India Hackathon 2026 (PS: 26081)</span>
            </div>
            <div className="text-[#747F9C] text-center sm:text-right">
              Real CartoDB Geographic Grid · 45 Indian Synoptic Observation Stations
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
