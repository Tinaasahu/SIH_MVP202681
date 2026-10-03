'use client';
import { useState, useEffect, useMemo } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { CustomDropdown } from '@/components/ui/CustomDropdown';
import { getCityForecastsData, MOCK_CITIES } from '@/lib/api';
import type { CityForecast } from '@/types';

interface RegionSelectorProps {
  selectedCity?: string | null;
  onSelectCity?: (city: string) => void;
}

export function RegionSelector({ selectedCity, onSelectCity }: RegionSelectorProps) {
  const [cities, setCities] = useState<CityForecast[]>(MOCK_CITIES);
  const [state, setState] = useState('Uttar Pradesh');
  const [district, setDistrict] = useState('Kanpur');
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isFallback, setIsFallback] = useState(false);

  // 1. Fetch dynamic cities list from API
  useEffect(() => {
    let mounted = true;
    getCityForecastsData()
      .then((data) => {
        if (mounted) {
          if (data && data.length > 0 && data !== MOCK_CITIES) {
            setCities(data);
            setIsFallback(false);
          } else {
            setCities(MOCK_CITIES);
            setIsFallback(true);
          }
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsError(true);
          setCities(MOCK_CITIES);
          setIsFallback(true);
          setIsLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Extract unique states dynamically from the 45 stations dataset
  const states = useMemo(() => {
    const unique = Array.from(new Set(cities.map((c) => c.state).filter(Boolean)));
    return unique.sort((a, b) => a.localeCompare(b));
  }, [cities]);

  // 3. Extract districts/forecast stations belonging to the selected state dynamically
  const districts = useMemo(() => {
    const stateCities = cities
      .filter((c) => c.state.toLowerCase() === state.toLowerCase())
      .map((c) => c.city)
      .sort((a, b) => a.localeCompare(b));
    return ['All Districts', ...stateCities];
  }, [cities, state]);

  // 4. Two-way synchronization: when selectedCity prop updates (e.g. from Leaflet map click)
  useEffect(() => {
    if (!selectedCity || cities.length === 0) return;
    const match = cities.find((c) => c.city.toLowerCase() === selectedCity.toLowerCase());
    if (match) {
      setState(match.state);
      setDistrict(match.city);
    }
  }, [selectedCity, cities]);

  // 5. State selection handler
  const handleStateChange = (newState: string) => {
    setState(newState);
    const available = cities
      .filter((c) => c.state.toLowerCase() === newState.toLowerCase())
      .map((c) => c.city)
      .sort((a, b) => a.localeCompare(b));

    const newDistrict = available.length > 0 ? available[0] : 'All Districts';
    setDistrict(newDistrict);

    if (newDistrict !== 'All Districts' && onSelectCity) {
      onSelectCity(newDistrict);
    }
  };

  // 6. District / Station selection handler
  const handleDistrictChange = (newDistrict: string) => {
    setDistrict(newDistrict);
    if (newDistrict !== 'All Districts' && onSelectCity) {
      onSelectCity(newDistrict);
    } else if (newDistrict === 'All Districts' && onSelectCity) {
      const available = cities.filter((c) => c.state.toLowerCase() === state.toLowerCase()).map((c) => c.city);
      if (available.length > 0) {
        onSelectCity(available[0]);
      }
    }
  };

  return (
    <GlassCard padding="md" variant="default">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <MapPin size={14} />
          </div>
          <span
            className="text-xs font-bold tracking-widest uppercase"
            style={{ letterSpacing: '0.12em', color: 'var(--text-primary, #14213d)' }}
          >
            REGION SELECTOR
          </span>
          {isFallback && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-400/30">
              Demo data (backend unavailable)
            </span>
          )}
        </div>
        <span className="text-[10px] text-sky-700 dark:text-sky-300 font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/35 shadow-xs flex items-center gap-1">
          <Navigation size={10} /> Auto-Zoom
        </span>
      </div>

      <div className="space-y-3.5">
        <CustomDropdown
          label="Country"
          options={['India']}
          value="India"
          onChange={() => {}}
        />

        <CustomDropdown
          label="State / Union Territory"
          options={states}
          value={state}
          onChange={handleStateChange}
        />

        <CustomDropdown
          label="District / Forecast Station"
          options={districts}
          value={district}
          onChange={handleDistrictChange}
        />
      </div>

      <div
        className="mt-4 rounded-xl px-3.5 py-3 flex items-center justify-between"
        style={{
          background: 'var(--card-sub-bg, rgba(255, 255, 255, 0.04))',
          border: 'var(--card-sub-border, 1px solid rgba(220, 225, 255, 0.10))'
        }}
      >
        <div className="flex items-center gap-2">
          <MapPin size={13} className="text-sky-600 dark:text-sky-400" />
          <span className="text-xs" style={{ color: 'var(--text-primary, #14213d)' }}>
            <span className="font-bold text-sky-700 dark:text-sky-300">{district === 'All Districts' ? state : district}</span>
            <span style={{ color: 'var(--text-secondary, #566075)' }}> · {state}</span>
          </span>
        </div>
        <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted, #747F9C)' }}>Synced with Map</span>
      </div>
    </GlassCard>
  );
}
