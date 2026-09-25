'use client';
import { useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { CustomDropdown } from '@/components/ui/CustomDropdown';
import { MOCK_STATES, MOCK_CITIES } from '@/data/mockData';

const DISTRICTS: Record<string, string[]> = {
  'Uttar Pradesh': ['All Districts', 'Kanpur', 'Lucknow', 'Varanasi', 'Agra', 'Ghaziabad'],
  'Maharashtra': ['All Districts', 'Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane'],
  'Rajasthan': ['All Districts', 'Jaipur', 'Jodhpur', 'Kota'],
  'Gujarat': ['All Districts', 'Ahmedabad', 'Surat', 'Vadodara'],
  'Madhya Pradesh': ['All Districts', 'Bhopal', 'Indore', 'Jabalpur'],
  'Tamil Nadu': ['All Districts', 'Chennai', 'Coimbatore', 'Madurai'],
  'Karnataka': ['All Districts', 'Bengaluru'],
  'West Bengal': ['All Districts', 'Kolkata'],
  'Delhi': ['Delhi Central', 'New Delhi'],
};

interface RegionSelectorProps {
  onSelectCity?: (city: string) => void;
}

export function RegionSelector({ onSelectCity }: RegionSelectorProps) {
  const [state, setState] = useState('Uttar Pradesh');
  const [district, setDistrict] = useState('Kanpur');

  const districts = DISTRICTS[state] || ['All Districts'];

  const handleStateChange = (newState: string) => {
    setState(newState);
    const available = DISTRICTS[newState] || ['All Districts'];
    const newDistrict = available.length > 1 ? available[1] : available[0];
    setDistrict(newDistrict);
    if (newDistrict !== 'All Districts' && onSelectCity) {
      onSelectCity(newDistrict);
    }
  };

  const handleDistrictChange = (newDistrict: string) => {
    setDistrict(newDistrict);
    if (newDistrict !== 'All Districts' && onSelectCity) {
      onSelectCity(newDistrict);
    }
  };

  return (
    <GlassCard padding="md">
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
          options={MOCK_STATES}
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
