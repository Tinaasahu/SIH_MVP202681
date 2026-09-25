'use client';
import { useState } from 'react';
import { Header } from '@/components/Header';
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
import { NavPage, CityForecast } from '@/types';

export default function Home() {
  const [currentPage, setCurrentPage] = useState<NavPage>('overview');
  const [selectedCity, setSelectedCity] = useState<string | null>('Kanpur');

  const handleCitySelect = (city: CityForecast | string) => {
    const cityName = typeof city === 'string' ? city : city.city;
    setSelectedCity(cityName);
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'forecast':
        return <ForecastPage />;
      case 'model-intelligence':
        return <ModelIntelligencePage />;
      case 'extreme-weather':
        return <ExtremeWeatherPage />;
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
    <div className="atmo-bg min-h-screen">
      {/* Under-Lightning Electric Cursor */}
      <CursorEffect />

      {/* Floating Boxed Taskbar Panel */}
      <Header currentPage={currentPage} onNavigate={setCurrentPage} />

      {/* Main Content with generous top padding to prevent ANY header overlap */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-36 pb-20">
        {renderContent()}
      </main>

      {/* Enterprise Scientific Footer */}
      <footer
        className="max-w-[1440px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500"
        style={{ borderTop: '1px solid rgba(148,163,184,0.18)' }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-700">Hybrid AI–NWP Blending Platform</span>
          <span>·</span>
          <span>MoES / NCMRWF</span>
          <span>·</span>
          <span>Smart India Hackathon 2026 (PS: 26081)</span>
        </div>
        <div className="text-slate-400 text-center sm:text-right">
          Real CartoDB Geographic Grid · 45 Indian Synoptic Observation Stations
        </div>
      </footer>
    </div>
  );
}
