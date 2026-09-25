'use client';
import { useState } from 'react';
import { ForecastHero } from '@/components/ForecastHero';
import { ForecastTimeline } from '@/components/ForecastTimeline';
import { ModelComparison } from '@/components/ModelComparison';
import { WeatherMap } from '@/components/WeatherMap';
import { RegionSelector } from '@/components/RegionSelector';

export function ForecastPage() {
  const [selectedCity, setSelectedCity] = useState<string | null>('Kanpur');

  return (
    <div className="space-y-6">
      <ForecastHero />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          <WeatherMap
            selectedCity={selectedCity}
            onSelectCity={(c) => setSelectedCity(typeof c === 'string' ? c : c.city)}
          />
          <ForecastTimeline />
          <ModelComparison />
        </div>
        <div className="lg:col-span-5 space-y-6">
          <RegionSelector onSelectCity={setSelectedCity} />
        </div>
      </div>
    </div>
  );
}
