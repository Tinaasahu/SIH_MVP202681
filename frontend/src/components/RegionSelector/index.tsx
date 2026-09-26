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

  // 1. Fetch dynamic cities list from API
  useEffect(() => {
    let mounted = true;
    getCityForecastsData()
      .then((data) => {
        if (mounted && data && data.length > 0) {
          setCities(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsError(true);
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
    <GlassCard padding="md" variant="orange">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
            <MapPin size={14} />
          </div>
          <span className="text-xs font-bold tracking-widest text-slate-700 uppercase" style={{ letterSpacing: '0.12em' }}>
            REGION SELECTOR
          </span>
        </div>
        <span className="text-[10px] text-blue-600 font-semibold px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 flex items-center gap-1">
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
        style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}
      >
        <div className="flex items-center gap-2">
          <MapPin size={13} className="text-blue-600" />
          <span className="text-xs text-slate-700">
            <span className="font-bold text-blue-700">{district === 'All Districts' ? state : district}</span>
            <span className="text-slate-400"> · {state}</span>
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-medium">Synced with Map</span>
      </div>
    </GlassCard>
  );
}
