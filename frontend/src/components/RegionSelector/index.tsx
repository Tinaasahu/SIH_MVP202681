'use client';
import { useState, useEffect, useMemo } from 'react';
import { MapPin, Navigation, Radio } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { CustomDropdown } from '@/components/ui/CustomDropdown';
import { getCityForecastsData, MOCK_CITIES, MOCK_STATES } from '@/lib/api';
import type { CityForecast } from '@/types';

interface RegionSelectorProps {
  selectedCity?: string | null;
  onSelectCity?: (city: string) => void;
}

const MAJOR_DISTRICTS_BY_STATE: Record<string, string[]> = {
  'Uttar Pradesh': [
    'Agra', 'Aligarh', 'Ayodhya', 'Bareilly', 'Ghaziabad',
    'Gorakhpur', 'Jhansi', 'Kanpur', 'Lucknow', 'Mathura',
    'Meerut', 'Moradabad', 'Noida', 'Prayagraj', 'Saharanpur', 'Varanasi',
  ],
  Maharashtra: [
    'Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik',
    'Aurangabad', 'Solapur', 'Kolhapur', 'Navi Mumbai', 'Amravati',
  ],
  Delhi: [
    'Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi',
    'North East Delhi', 'North West Delhi', 'South Delhi', 'South West Delhi', 'West Delhi',
  ],
  Gujarat: [
    'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Gandhinagar', 'Jamnagar',
  ],
  Rajasthan: [
    'Jaipur', 'Jodhpur', 'Kota', 'Udaipur', 'Bikaner', 'Ajmer', 'Alwar', 'Bharatpur',
  ],
  Punjab: [
    'Amritsar', 'Ludhiana', 'Chandigarh', 'Jalandhar', 'Patiala', 'Bathinda',
  ],
  Haryana: [
    'Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Hisar', 'Karnal', 'Rohtak', 'Sonipat',
  ],
  Bihar: [
    'Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur', 'Darbhanga', 'Purnia',
  ],
  'Madhya Pradesh': [
    'Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar',
  ],
  'Tamil Nadu': [
    'Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Tiruchirappalli', 'Tirunelveli',
  ],
  Karnataka: [
    'Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi', 'Kalaburagi',
  ],
  Kerala: [
    'Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur',
  ],
  'West Bengal': [
    'Kolkata', 'Howrah', 'Siliguri', 'Durgapur', 'Asansol', 'Darjeeling',
  ],
  'Andhra Pradesh': [
    'Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati', 'Kakinada', 'Nellore',
  ],
  Telangana: [
    'Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam',
  ],
  Odisha: [
    'Bhubaneswar', 'Cuttack', 'Rourkela', 'Puri', 'Sambalpur', 'Berhampur',
  ],
  Assam: [
    'Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tezpur',
  ],
  Jharkhand: [
    'Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar',
  ],
  Chhattisgarh: [
    'Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg',
  ],
  Uttarakhand: [
    'Dehradun', 'Haridwar', 'Rishikesh', 'Nainital', 'Haldwani', 'Roorkee',
  ],
  'Himachal Pradesh': [
    'Shimla', 'Dharamshala', 'Manali', 'Kullu', 'Mandi', 'Solan',
  ],
  'Jammu & Kashmir': [
    'Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Udhampur',
  ],
  Goa: [
    'North Goa (Panaji)', 'South Goa (Margao)',
  ],
  Tripura: [
    'Agartala', 'Udaipur (Gomati)', 'Dharmanagar',
  ],
  Meghalaya: [
    'Shillong', 'Tura', 'Jowai',
  ],
  Manipur: [
    'Imphal', 'Churachandpur', 'Thoubal',
  ],
};

const DISTRICT_TO_STATION: Record<string, string> = {
  // Uttar Pradesh
  Prayagraj: 'Varanasi',
  Noida: 'Ghaziabad',
  Meerut: 'Ghaziabad',
  Bareilly: 'Lucknow',
  Gorakhpur: 'Varanasi',
  Aligarh: 'Agra',
  Mathura: 'Agra',
  Jhansi: 'Kanpur',
  Ayodhya: 'Lucknow',
  Moradabad: 'Ghaziabad',
  Saharanpur: 'Dehradun',
  // Delhi
  'Central Delhi': 'Delhi',
  'East Delhi': 'Delhi',
  'New Delhi': 'Delhi',
  'North Delhi': 'Delhi',
  'North East Delhi': 'Delhi',
  'North West Delhi': 'Delhi',
  'South Delhi': 'Delhi',
  'South West Delhi': 'Delhi',
  'West Delhi': 'Delhi',
  // Haryana
  Gurugram: 'Delhi',
  Faridabad: 'Delhi',
  Panipat: 'Chandigarh',
  Ambala: 'Chandigarh',
  Hisar: 'Delhi',
  Karnal: 'Chandigarh',
  Rohtak: 'Delhi',
  Sonipat: 'Delhi',
  // Bihar
  Gaya: 'Patna',
  Muzaffarpur: 'Patna',
  Bhagalpur: 'Patna',
  Darbhanga: 'Patna',
  Purnia: 'Patna',
  // Rajasthan
  Udaipur: 'Jodhpur',
  Bikaner: 'Jodhpur',
  Ajmer: 'Jaipur',
  Alwar: 'Jaipur',
  Bharatpur: 'Agra',
  // Maharashtra
  Aurangabad: 'Pune',
  Solapur: 'Pune',
  Kolhapur: 'Pune',
  'Navi Mumbai': 'Mumbai',
  Amravati: 'Nagpur',
  // Gujarat
  Rajkot: 'Ahmedabad',
  Bhavnagar: 'Ahmedabad',
  Gandhinagar: 'Ahmedabad',
  Jamnagar: 'Ahmedabad',
  // Punjab
  Jalandhar: 'Amritsar',
  Patiala: 'Chandigarh',
  Bathinda: 'Ludhiana',
  // Madhya Pradesh
  Gwalior: 'Agra',
  Ujjain: 'Indore',
  Sagar: 'Jabalpur',
  // Tamil Nadu
  Salem: 'Coimbatore',
  Tiruchirappalli: 'Madurai',
  Tirunelveli: 'Madurai',
  // Karnataka
  Mysuru: 'Bengaluru',
  Mangaluru: 'Bengaluru',
  Hubballi: 'Bengaluru',
  Belagavi: 'Bengaluru',
  Kalaburagi: 'Hyderabad',
  // Kerala
  Kozhikode: 'Kochi',
  Kollam: 'Thiruvananthapuram',
  Thrissur: 'Kochi',
  Kannur: 'Kochi',
  // West Bengal
  Howrah: 'Kolkata',
  Siliguri: 'Kolkata',
  Durgapur: 'Kolkata',
  Asansol: 'Kolkata',
  Darjeeling: 'Kolkata',
  // Andhra Pradesh
  Guntur: 'Vijayawada',
  Tirupati: 'Chennai',
  Kakinada: 'Visakhapatnam',
  Nellore: 'Chennai',
  // Telangana
  Warangal: 'Hyderabad',
  Nizamabad: 'Hyderabad',
  Karimnagar: 'Hyderabad',
  Khammam: 'Vijayawada',
  // Odisha
  Cuttack: 'Bhubaneswar',
  Puri: 'Bhubaneswar',
  Rourkela: 'Ranchi',
  Sambalpur: 'Bhubaneswar',
  Berhampur: 'Bhubaneswar',
  // Assam
  Dibrugarh: 'Guwahati',
  Silchar: 'Guwahati',
  Jorhat: 'Guwahati',
  Nagaon: 'Guwahati',
  Tezpur: 'Guwahati',
  // Jharkhand
  Jamshedpur: 'Ranchi',
  Dhanbad: 'Ranchi',
  Bokaro: 'Ranchi',
  Deoghar: 'Patna',
  // Chhattisgarh
  Bhilai: 'Raipur',
  Bilaspur: 'Raipur',
  Korba: 'Raipur',
  Durg: 'Raipur',
  // Uttarakhand
  Haridwar: 'Dehradun',
  Rishikesh: 'Dehradun',
  Nainital: 'Dehradun',
  Haldwani: 'Dehradun',
  Roorkee: 'Dehradun',
  // Himachal Pradesh
  Dharamshala: 'Shimla',
  Manali: 'Shimla',
  Kullu: 'Shimla',
  Mandi: 'Shimla',
  Solan: 'Shimla',
  // Jammu & Kashmir
  Jammu: 'Srinagar',
  Anantnag: 'Srinagar',
  Baramulla: 'Srinagar',
  Udhampur: 'Srinagar',
  // Goa
  'North Goa (Panaji)': 'Goa',
  'South Goa (Margao)': 'Goa',
  // Tripura
  'Udaipur (Gomati)': 'Agartala',
  Dharmanagar: 'Agartala',
  // Meghalaya
  Tura: 'Shillong',
  Jowai: 'Shillong',
  // Manipur
  Churachandpur: 'Imphal',
  Thoubal: 'Imphal',
};

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

  // 2. Extract states list: include All India + all standard Indian states + dynamic states
  const states = useMemo(() => {
    const fromCities = cities.map((c) => c.state).filter(Boolean);
    const fromMock = MOCK_STATES.filter((s) => s !== 'All India');
    const merged = Array.from(new Set([...fromCities, ...fromMock]));
    merged.sort((a, b) => a.localeCompare(b));
    return ['All India', ...merged];
  }, [cities]);

  // 3. Extract districts/forecast stations belonging to the selected state dynamically
  const districts = useMemo(() => {
    if (state === 'All India') {
      const allStations = Array.from(new Set(cities.map((c) => c.city))).sort((a, b) =>
        a.localeCompare(b)
      );
      return ['All Districts', ...allStations];
    }

    const stateCities = cities
      .filter((c) => c.state.toLowerCase() === state.toLowerCase())
      .map((c) => c.city);

    const majorDistricts = MAJOR_DISTRICTS_BY_STATE[state] || [];
    const combined = Array.from(new Set([...stateCities, ...majorDistricts])).sort((a, b) =>
      a.localeCompare(b)
    );

    return ['All Districts', ...combined];
  }, [cities, state]);

  // 4. Two-way synchronization: when selectedCity prop updates (e.g. from Leaflet map click)
  useEffect(() => {
    if (!selectedCity || cities.length === 0) return;
    const match = cities.find((c) => c.city.toLowerCase() === selectedCity.toLowerCase());
    if (match) {
      setState(match.state);
      setDistrict(match.city);
      return;
    }

    // Check if selectedCity matches a mapped district
    for (const [distName, stationName] of Object.entries(DISTRICT_TO_STATION)) {
      if (distName.toLowerCase() === selectedCity.toLowerCase()) {
        const stationMatch = cities.find((c) => c.city.toLowerCase() === stationName.toLowerCase());
        if (stationMatch) {
          setState(stationMatch.state);
          setDistrict(distName);
          return;
        }
      }
    }
  }, [selectedCity, cities]);

  // 5. State selection handler
  const handleStateChange = (newState: string) => {
    setState(newState);

    if (newState === 'All India') {
      const defaultCity = cities[0]?.city || 'Kanpur';
      setDistrict('All Districts');
      if (onSelectCity) onSelectCity(defaultCity);
      return;
    }

    const stateCities = cities
      .filter((c) => c.state.toLowerCase() === newState.toLowerCase())
      .map((c) => c.city);
    const majorDistricts = MAJOR_DISTRICTS_BY_STATE[newState] || [];
    const combined = Array.from(new Set([...stateCities, ...majorDistricts])).sort((a, b) =>
      a.localeCompare(b)
    );

    const preferred = stateCities.length > 0 ? stateCities[0] : combined[0] || 'All Districts';
    setDistrict(preferred);

    if (preferred !== 'All Districts' && onSelectCity) {
      const targetStation = DISTRICT_TO_STATION[preferred] || preferred;
      onSelectCity(targetStation);
    }
  };

  // 6. District / Station selection handler
  const handleDistrictChange = (newDistrict: string) => {
    setDistrict(newDistrict);

    if (newDistrict === 'All Districts') {
      if (state === 'All India') {
        const defaultCity = cities[0]?.city || 'Kanpur';
        if (onSelectCity) onSelectCity(defaultCity);
        return;
      }
      const available = cities.filter((c) => c.state.toLowerCase() === state.toLowerCase()).map((c) => c.city);
      if (available.length > 0 && onSelectCity) {
        onSelectCity(available[0]);
      }
      return;
    }

    if (!onSelectCity) return;

    // Check direct match in synoptic stations
    const directMatch = cities.find((c) => c.city.toLowerCase() === newDistrict.toLowerCase());
    if (directMatch) {
      onSelectCity(directMatch.city);
      return;
    }

    // Check if district is mapped to nearest station
    const mappedStation = DISTRICT_TO_STATION[newDistrict];
    if (mappedStation) {
      onSelectCity(mappedStation);
      return;
    }

    // Fallback: pick first available station in that state or pass district
    const stateStations = cities.filter((c) => c.state.toLowerCase() === state.toLowerCase()).map((c) => c.city);
    if (stateStations.length > 0) {
      onSelectCity(stateStations[0]);
    } else {
      onSelectCity(newDistrict);
    }
  };

  const isCurrentAStation = cities.some(
    (c) => c.city.toLowerCase() === district.toLowerCase()
  );

  return (
    <GlassCard padding="md" variant="default" className="relative z-30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400">
            <MapPin size={14} />
          </div>
          <span
            className="text-xs font-bold tracking-widest uppercase"
            style={{ letterSpacing: '0.12em', color: 'var(--text-primary, #F3F5FA)' }}
          >
            REGION SELECTOR
          </span>
          {isFallback && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
              Demo data
            </span>
          )}
        </div>
        <span className="text-[10px] text-sky-300 font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/35 shadow-xs flex items-center gap-1">
          <Navigation size={10} /> Auto-Zoom
        </span>
      </div>

      <div className="space-y-3.5">
        <CustomDropdown
          label="Country"
          options={['India']}
          value="India"
          onChange={() => {}}
          className="z-30"
        />

        <CustomDropdown
          label="State / Union Territory"
          options={states}
          value={state}
          onChange={handleStateChange}
          badge={`${states.length - 1} States`}
          className="z-20"
        />

        <CustomDropdown
          label="District / Forecast Station"
          options={districts}
          value={district}
          onChange={handleDistrictChange}
          badge={`${districts.length - 1} Locations`}
          className="z-10"
        />
      </div>

      <div
        className="mt-4 rounded-xl px-3.5 py-3 flex items-center justify-between"
        style={{
          background: 'var(--card-sub-bg, rgba(255, 255, 255, 0.04))',
          border: 'var(--card-sub-border, 1px solid rgba(220, 225, 255, 0.12))',
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <MapPin size={13} className="text-sky-400 shrink-0" />
          <span className="text-xs truncate" style={{ color: 'var(--text-primary, #F3F5FA)' }}>
            <span className="font-bold text-sky-400">
              {district === 'All Districts' ? state : district}
            </span>
            <span style={{ color: 'var(--text-secondary, #A9B2C8)' }}> · {state}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {isCurrentAStation && (
            <span className="text-[9px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-400/20 flex items-center gap-1">
              <Radio size={9} /> Synoptic Post
            </span>
          )}
          <span className="text-[10px] font-medium text-sky-300/80 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-400/20">
            Synced
          </span>
        </div>
      </div>
    </GlassCard>
  );
}
