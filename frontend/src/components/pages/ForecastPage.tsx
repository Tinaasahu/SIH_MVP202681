'use client';
import { useState, useEffect } from 'react';
import { ForecastHero } from '@/components/ForecastHero';
import { ForecastTimeline } from '@/components/ForecastTimeline';
import { ModelComparison } from '@/components/ModelComparison';
import { WeatherMap } from '@/components/WeatherMap';
import { RegionSelector } from '@/components/RegionSelector';

interface ForecastPageProps {
  selectedCity?: string | null;
  onSelectCity?: (city: string) => void;
}

export function ForecastPage({ selectedCity: initialCity = 'Kanpur', onSelectCity }: ForecastPageProps) {
  const [selectedCity, setSelectedCity] = useState<string | null>(initialCity || 'Kanpur');

  useEffect(() => {
    if (initialCity && initialCity !== selectedCity) {
      setSelectedCity(initialCity);
    }
  }, [initialCity]);

  const handleCityChange = (c: any) => {
    const cityName = typeof c === 'string' ? c : c?.city || 'Kanpur';
    setSelectedCity(cityName);
    if (onSelectCity) onSelectCity(cityName);
  };

  return (
    <div className="space-y-6">
      <ForecastHero selectedCity={selectedCity} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          <WeatherMap
            selectedCity={selectedCity}
            onSelectCity={handleCityChange}
          />
          <ForecastTimeline selectedCity={selectedCity} />
          <ModelComparison selectedCity={selectedCity} />
        </div>
        <div className="lg:col-span-5 space-y-6">
          <RegionSelector selectedCity={selectedCity} onSelectCity={handleCityChange} />
        </div>
      </div>
    </div>
  );
}
