export type Variable = 'rainfall' | 'temperature' | 'wind';
export type LeadTime = '6h' | '12h' | '24h' | '48h' | '72h';
export type MapLayer = 'rainfall' | 'temperature' | 'wind' | 'extreme_risk' | 'model_dominance' | 'confidence' | 'anomaly';
export type ModelMode = 'blended' | 'ai' | 'nwp' | 'ensemble';
export type NavPage = 'overview' | 'forecast' | 'model-intelligence' | 'extreme-weather' | 'model-performance' | 'data-health';

export interface ForecastMetrics {
  rainfall: number;
  temperature: number;
  wind: number;
  confidence: number;
  rainfallUncertainty: number;
  temperatureUncertainty: number;
  windUncertainty: number;
  updatedMinutesAgo: number;
}

export interface ModelWeight {
  name: string;
  id: string;
  weight: number;
  color: string;
  rmse: number;
  mae: number;
}

export interface TimelinePoint {
  time: string;
  label: string;
  rainfall: number;
  temperature: number;
  wind: number;
  confidence: number;
  risk: 'low' | 'moderate' | 'high' | 'severe';
  rainfallUncertaintyHigh: number;
  rainfallUncertaintyLow: number;
}

export interface ExtremeEvent {
  type: 'heavy_rainfall' | 'heatwave' | 'high_wind' | 'cyclone' | 'cold_wave';
  label: string;
  probability: number;
  window: string;
  confidence: number;
  severity: 'watch' | 'warning' | 'alert';
  description: string;
}

export interface Alert {
  id: string;
  type: 'danger' | 'warning' | 'info';
  title: string;
  location: string;
  window: string;
  timestamp: string;
}

export interface DataSource {
  id: string;
  name: string;
  status: 'healthy' | 'delayed' | 'unavailable';
  lastUpdated: string;
  latencyMs: number;
}

export interface ModelComparison {
  model: string;
  rainfall: number;
  temperature: number;
  wind: number;
  isBlended?: boolean;
}

export interface RegionModelDominance {
  region: string;
  dominantModel: string;
  modelId: string;
  confidence: number;
}

export interface CityForecast {
  city: string;
  state: string;
  lat: number;
  lon: number;
  rainfall: number;
  temperature: number;
  wind: number;
  confidence: number;
  dominantModel: string;
  risk: 'low' | 'moderate' | 'high' | 'severe';
}

export interface SkillMetric {
  period: string;
  blended: number;
  ai: number;
  nwpA: number;
  nwpB: number;
  ensemble: number;
}
