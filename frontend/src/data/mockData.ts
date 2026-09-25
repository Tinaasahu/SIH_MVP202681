/**
 * MOCK DATA — Replace with real API calls when backend is ready.
 * All values are realistic demo data for presentation purposes.
 * Do NOT present these as operational forecasts.
 */

import type {
  ForecastMetrics,
  ModelWeight,
  TimelinePoint,
  ExtremeEvent,
  Alert,
  DataSource,
  ModelComparison,
  RegionModelDominance,
  CityForecast,
  SkillMetric,
} from '@/types';

export const MOCK_FORECAST: ForecastMetrics = {
  rainfall: 72,
  temperature: 31.4,
  wind: 18,
  confidence: 87,
  rainfallUncertainty: 14,
  temperatureUncertainty: 1.2,
  windUncertainty: 3,
  updatedMinutesAgo: 8,
};

export const MOCK_MODEL_WEIGHTS: ModelWeight[] = [
  { name: 'AI Model', id: 'ai', weight: 45, color: '#3b82f6', rmse: 5.1, mae: 3.8 },
  { name: 'ECMWF IFS', id: 'ecmwf', weight: 35, color: '#0ea5e9', rmse: 5.8, mae: 4.2 },
  { name: 'GFS Seamless', id: 'gfs', weight: 12, color: '#6366f1', rmse: 6.3, mae: 4.9 },
  { name: 'Ensemble', id: 'ensemble', weight: 8, color: '#8b5cf6', rmse: 5.5, mae: 4.1 },
];

export const MOCK_TIMELINE: TimelinePoint[] = [
  { time: 'NOW', label: '22:00', rainfall: 45, temperature: 30.2, wind: 15, confidence: 91, risk: 'moderate', rainfallUncertaintyHigh: 52, rainfallUncertaintyLow: 38 },
  { time: '+6h', label: '04:00', rainfall: 68, temperature: 28.8, wind: 17, confidence: 89, risk: 'high', rainfallUncertaintyHigh: 80, rainfallUncertaintyLow: 56 },
  { time: '+12h', label: '10:00', rainfall: 82, temperature: 29.4, wind: 22, confidence: 85, risk: 'severe', rainfallUncertaintyHigh: 98, rainfallUncertaintyLow: 66 },
  { time: '+24h', label: '22:00', rainfall: 72, temperature: 31.4, wind: 18, confidence: 87, risk: 'high', rainfallUncertaintyHigh: 86, rainfallUncertaintyLow: 58 },
  { time: '+48h', label: '22:00', rainfall: 38, temperature: 32.1, wind: 14, confidence: 76, risk: 'moderate', rainfallUncertaintyHigh: 54, rainfallUncertaintyLow: 22 },
  { time: '+72h', label: '22:00', rainfall: 18, temperature: 33.2, wind: 11, confidence: 61, risk: 'low', rainfallUncertaintyHigh: 34, rainfallUncertaintyLow: 2 },
];

export const MOCK_EXTREME_EVENTS: ExtremeEvent[] = [
  {
    type: 'heavy_rainfall',
    label: 'Heavy Rainfall',
    probability: 78,
    window: '02:00 – 10:00 IST',
    confidence: 84,
    severity: 'warning',
    description: 'Sustained heavy rainfall exceeding 64.5 mm expected. Urban flooding possible.',
  },
  {
    type: 'high_wind',
    label: 'High Wind',
    probability: 31,
    window: 'Next 24h',
    confidence: 67,
    severity: 'watch',
    description: 'Gusty winds with potential to exceed 63 km/h during peak convective activity.',
  },
  {
    type: 'heatwave',
    label: 'Heat Wave',
    probability: 12,
    window: '+48h – +72h',
    confidence: 52,
    severity: 'watch',
    description: 'Post-rainfall temperature rebound. Low probability for conditions meeting IMD heatwave criteria.',
  },
];

export const MOCK_ALERTS: Alert[] = [
  { id: 'a1', type: 'danger', title: 'Heavy rainfall risk', location: 'Kanpur, UP', window: '02:00–10:00 IST', timestamp: '2 min ago' },
  { id: 'a2', type: 'warning', title: 'High wind probability', location: 'Jaipur, Rajasthan', window: 'Next 24h', timestamp: '14 min ago' },
  { id: 'a3', type: 'info', title: 'Temperature anomaly', location: 'Central India', window: 'Next 48h', timestamp: '31 min ago' },
  { id: 'a4', type: 'warning', title: 'Elevated rainfall', location: 'Guwahati, Assam', window: '+6h – +18h', timestamp: '45 min ago' },
];

export const MOCK_DATA_SOURCES: DataSource[] = [
  { id: 'ecmwf', name: 'ECMWF IFS', status: 'healthy', lastUpdated: '10 min ago', latencyMs: 240 },
  { id: 'gfs', name: 'GFS Seamless', status: 'healthy', lastUpdated: '18 min ago', latencyMs: 380 },
  { id: 'icon', name: 'ICON Seamless', status: 'healthy', lastUpdated: '12 min ago', latencyMs: 190 },
  { id: 'gem', name: 'GEM Seamless', status: 'healthy', lastUpdated: '22 min ago', latencyMs: 420 },
  { id: 'era5', name: 'ERA5 Reanalysis', status: 'delayed', lastUpdated: '2h 14 min ago', latencyMs: 1200 },
  { id: 'obs', name: 'IMD Observations', status: 'delayed', lastUpdated: '1h 03 min ago', latencyMs: 890 },
];

export const MOCK_MODEL_COMPARISON: ModelComparison[] = [
  { model: 'AI Model', rainfall: 61, temperature: 30.8, wind: 16 },
  { model: 'ECMWF IFS', rainfall: 82, temperature: 32.1, wind: 19 },
  { model: 'GFS Seamless', rainfall: 74, temperature: 31.6, wind: 21 },
  { model: 'Ensemble', rainfall: 69, temperature: 31.0, wind: 18 },
  { model: 'Blended', rainfall: 72, temperature: 31.4, wind: 18, isBlended: true },
];

export const MOCK_REGION_DOMINANCE: RegionModelDominance[] = [
  { region: 'North India', dominantModel: 'ECMWF IFS', modelId: 'ecmwf', confidence: 82 },
  { region: 'Central India', dominantModel: 'AI Model', modelId: 'ai', confidence: 79 },
  { region: 'East India', dominantModel: 'Ensemble', modelId: 'ensemble', confidence: 71 },
  { region: 'South India', dominantModel: 'GFS Seamless', modelId: 'gfs', confidence: 75 },
  { region: 'West India', dominantModel: 'AI Model', modelId: 'ai', confidence: 84 },
  { region: 'Northeast', dominantModel: 'ECMWF IFS', modelId: 'ecmwf', confidence: 68 },
];

export const MOCK_CITIES: CityForecast[] = [
  { city: 'Delhi', state: 'Delhi', lat: 28.6139, lon: 77.2090, rainfall: 28, temperature: 34.1, wind: 12, confidence: 82, dominantModel: 'AI', risk: 'moderate' },
  { city: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lon: 72.8777, rainfall: 94, temperature: 29.2, wind: 24, confidence: 88, dominantModel: 'ECMWF', risk: 'severe' },
  { city: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lon: 80.2707, rainfall: 18, temperature: 33.8, wind: 16, confidence: 79, dominantModel: 'GFS', risk: 'low' },
  { city: 'Kolkata', state: 'West Bengal', lat: 22.5726, lon: 88.3639, rainfall: 62, temperature: 30.5, wind: 20, confidence: 85, dominantModel: 'AI', risk: 'high' },
  { city: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lon: 75.7873, rainfall: 8, temperature: 36.2, wind: 31, confidence: 71, dominantModel: 'ECMWF', risk: 'moderate' },
  { city: 'Guwahati', state: 'Assam', lat: 26.1445, lon: 91.7362, rainfall: 88, temperature: 28.4, wind: 26, confidence: 77, dominantModel: 'ECMWF', risk: 'severe' },
  { city: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lon: 77.5946, rainfall: 34, temperature: 27.8, wind: 14, confidence: 83, dominantModel: 'GFS', risk: 'moderate' },
  { city: 'Hyderabad', state: 'Telangana', lat: 17.3850, lon: 78.4867, rainfall: 42, temperature: 31.1, wind: 18, confidence: 80, dominantModel: 'Ensemble', risk: 'moderate' },
  { city: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lon: 72.5714, rainfall: 12, temperature: 35.4, wind: 22, confidence: 76, dominantModel: 'ECMWF', risk: 'low' },
  { city: 'Pune', state: 'Maharashtra', lat: 18.5204, lon: 73.8567, rainfall: 56, temperature: 28.6, wind: 19, confidence: 84, dominantModel: 'AI', risk: 'high' },
  { city: 'Surat', state: 'Gujarat', lat: 21.1702, lon: 72.8311, rainfall: 38, temperature: 32.5, wind: 18, confidence: 81, dominantModel: 'ECMWF', risk: 'moderate' },
  { city: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lon: 80.9462, rainfall: 65, temperature: 31.2, wind: 15, confidence: 86, dominantModel: 'AI', risk: 'high' },
  { city: 'Kanpur', state: 'Uttar Pradesh', lat: 26.4499, lon: 80.3319, rainfall: 72, temperature: 30.8, wind: 17, confidence: 89, dominantModel: 'AI', risk: 'high' },
  { city: 'Nagpur', state: 'Maharashtra', lat: 21.1458, lon: 79.0882, rainfall: 45, temperature: 32.0, wind: 16, confidence: 82, dominantModel: 'Ensemble', risk: 'moderate' },
  { city: 'Indore', state: 'Madhya Pradesh', lat: 22.7196, lon: 75.8577, rainfall: 22, temperature: 33.4, wind: 14, confidence: 79, dominantModel: 'GFS', risk: 'low' },
  { city: 'Thane', state: 'Maharashtra', lat: 19.2183, lon: 72.9781, rainfall: 91, temperature: 29.4, wind: 23, confidence: 87, dominantModel: 'ECMWF', risk: 'severe' },
  { city: 'Bhopal', state: 'Madhya Pradesh', lat: 23.2599, lon: 77.4126, rainfall: 31, temperature: 32.8, wind: 15, confidence: 80, dominantModel: 'GFS', risk: 'moderate' },
  { city: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.6868, lon: 83.2185, rainfall: 54, temperature: 31.6, wind: 24, confidence: 83, dominantModel: 'ECMWF', risk: 'high' },
  { city: 'Patna', state: 'Bihar', lat: 25.5941, lon: 85.1376, rainfall: 49, temperature: 31.8, wind: 13, confidence: 78, dominantModel: 'AI', risk: 'moderate' },
  { city: 'Vadodara', state: 'Gujarat', lat: 22.3072, lon: 73.1812, rainfall: 26, temperature: 34.0, wind: 19, confidence: 80, dominantModel: 'ECMWF', risk: 'low' },
  { city: 'Ghaziabad', state: 'Uttar Pradesh', lat: 28.6692, lon: 77.4538, rainfall: 30, temperature: 33.9, wind: 13, confidence: 83, dominantModel: 'AI', risk: 'moderate' },
  { city: 'Ludhiana', state: 'Punjab', lat: 30.9010, lon: 75.8573, rainfall: 14, temperature: 33.5, wind: 15, confidence: 77, dominantModel: 'GFS', risk: 'low' },
  { city: 'Agra', state: 'Uttar Pradesh', lat: 27.1767, lon: 78.0081, rainfall: 35, temperature: 33.2, wind: 14, confidence: 82, dominantModel: 'AI', risk: 'moderate' },
  { city: 'Nashik', state: 'Maharashtra', lat: 19.9975, lon: 73.7898, rainfall: 60, temperature: 27.9, wind: 21, confidence: 85, dominantModel: 'ECMWF', risk: 'high' },
  { city: 'Ranchi', state: 'Jharkhand', lat: 23.3441, lon: 85.3096, rainfall: 58, temperature: 28.9, wind: 17, confidence: 81, dominantModel: 'AI', risk: 'high' },
  { city: 'Varanasi', state: 'Uttar Pradesh', lat: 25.3176, lon: 82.9739, rainfall: 63, temperature: 31.0, wind: 16, confidence: 84, dominantModel: 'AI', risk: 'high' },
  { city: 'Srinagar', state: 'Jammu & Kashmir', lat: 34.0837, lon: 74.7973, rainfall: 4, temperature: 22.1, wind: 8, confidence: 68, dominantModel: 'GFS', risk: 'low' },
  { city: 'Amritsar', state: 'Punjab', lat: 31.6340, lon: 74.8723, rainfall: 11, temperature: 34.2, wind: 16, confidence: 75, dominantModel: 'GFS', risk: 'low' },
  { city: 'Coimbatore', state: 'Tamil Nadu', lat: 11.0168, lon: 76.9558, rainfall: 22, temperature: 30.1, wind: 18, confidence: 84, dominantModel: 'GFS', risk: 'low' },
  { city: 'Vijayawada', state: 'Andhra Pradesh', lat: 16.5062, lon: 80.6480, rainfall: 44, temperature: 33.0, wind: 21, confidence: 80, dominantModel: 'Ensemble', risk: 'moderate' },
  { city: 'Jodhpur', state: 'Rajasthan', lat: 26.2389, lon: 73.0243, rainfall: 5, temperature: 37.8, wind: 29, confidence: 73, dominantModel: 'ECMWF', risk: 'low' },
  { city: 'Madurai', state: 'Tamil Nadu', lat: 9.9252, lon: 78.1198, rainfall: 16, temperature: 34.5, wind: 19, confidence: 79, dominantModel: 'GFS', risk: 'low' },
  { city: 'Raipur', state: 'Chhattisgarh', lat: 21.2514, lon: 81.6296, rainfall: 52, temperature: 31.5, wind: 17, confidence: 82, dominantModel: 'AI', risk: 'high' },
  { city: 'Kota', state: 'Rajasthan', lat: 25.2138, lon: 75.8648, rainfall: 19, temperature: 35.1, wind: 20, confidence: 77, dominantModel: 'ECMWF', risk: 'low' },
  { city: 'Chandigarh', state: 'Punjab', lat: 30.7333, lon: 76.7794, rainfall: 20, temperature: 32.8, wind: 12, confidence: 81, dominantModel: 'GFS', risk: 'low' },
  { city: 'Dehradun', state: 'Uttarakhand', lat: 30.3165, lon: 78.0322, rainfall: 70, temperature: 27.4, wind: 15, confidence: 83, dominantModel: 'ECMWF', risk: 'high' },
  { city: 'Shimla', state: 'Himachal Pradesh', lat: 31.1048, lon: 77.1734, rainfall: 42, temperature: 20.5, wind: 14, confidence: 75, dominantModel: 'ECMWF', risk: 'moderate' },
  { city: 'Thiruvananthapuram', state: 'Kerala', lat: 8.5241, lon: 76.9366, rainfall: 48, temperature: 30.2, wind: 22, confidence: 81, dominantModel: 'Ensemble', risk: 'moderate' },
  { city: 'Kochi', state: 'Kerala', lat: 9.9312, lon: 76.2673, rainfall: 68, temperature: 29.8, wind: 25, confidence: 85, dominantModel: 'ECMWF', risk: 'high' },
  { city: 'Bhubaneswar', state: 'Odisha', lat: 20.2961, lon: 85.8245, rainfall: 78, temperature: 29.8, wind: 28, confidence: 86, dominantModel: 'AI', risk: 'high' },
  { city: 'Goa', state: 'Goa', lat: 15.2993, lon: 74.1240, rainfall: 82, temperature: 28.7, wind: 26, confidence: 87, dominantModel: 'ECMWF', risk: 'severe' },
  { city: 'Imphal', state: 'Manipur', lat: 24.8170, lon: 93.9368, rainfall: 55, temperature: 26.5, wind: 12, confidence: 76, dominantModel: 'AI', risk: 'moderate' },
  { city: 'Shillong', state: 'Meghalaya', lat: 25.5788, lon: 91.8933, rainfall: 96, temperature: 21.2, wind: 18, confidence: 82, dominantModel: 'ECMWF', risk: 'severe' },
  { city: 'Agartala', state: 'Tripura', lat: 23.8315, lon: 91.2868, rainfall: 64, temperature: 29.1, wind: 15, confidence: 80, dominantModel: 'AI', risk: 'high' },
  { city: 'Jabalpur', state: 'Madhya Pradesh', lat: 23.1815, lon: 79.9864, rainfall: 39, temperature: 31.9, wind: 14, confidence: 81, dominantModel: 'Ensemble', risk: 'moderate' },
];

export const MOCK_SKILL_METRICS: SkillMetric[] = [
  { period: 'Today', blended: 4.2, ai: 5.1, nwpA: 5.8, nwpB: 6.3, ensemble: 5.5 },
  { period: '7 Days', blended: 4.8, ai: 5.6, nwpA: 6.1, nwpB: 6.8, ensemble: 5.9 },
  { period: '30 Days', blended: 5.1, ai: 5.9, nwpA: 6.4, nwpB: 7.1, ensemble: 6.2 },
  { period: 'Season', blended: 5.4, ai: 6.2, nwpA: 6.8, nwpB: 7.4, ensemble: 6.5 },
];

export const MOCK_STATES = [
  'All India', 'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
  'Jammu & Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

export const ENGINE_STATUS = {
  modelsAnalyzed: 4,
  regionsEvaluated: 45,
  leadTime: '24h',
  currentRegime: 'Heavy Rain',
  adaptiveWeighting: true,
  confidence: 87,
  lastRecalculation: '22:18:42 IST',
  lastDataRefresh: '22:10:18 IST',
  nextUpdate: '23:00:00 IST',
};
