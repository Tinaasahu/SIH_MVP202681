export type Variable = 'rainfall' | 'temperature' | 'wind';
export type LeadTime = '6h' | '12h' | '24h' | '48h' | '72h';
export type MapLayer = 'rainfall' | 'temperature' | 'wind' | 'extreme_risk' | 'model_dominance' | 'confidence' | 'anomaly';
export type ModelMode = 'blended' | 'ai' | 'nwp' | 'ensemble';
export type NavPage = 'overview' | 'forecast' | 'model-intelligence' | 'extreme-weather' | 'model-performance' | 'data-health' | 'rpi';

export interface ForecastMetrics {
  rainfall: number;
  temperature: number;
  wind: number;
  confidence: number;
  confidenceLabel?: string;
  dominantModel?: string;
  explanation?: string;
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
  rmse: number | null;
  mae: number | null;
  skillAvailable?: boolean;
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
  temperatureUncertaintyHigh?: number;
  temperatureUncertaintyLow?: number;
  windUncertaintyHigh?: number;
  windUncertaintyLow?: number;
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
  state?: string;
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
  confidenceLabel?: string;
  explanation?: string;
}

export interface ConfidenceRecord {
  city: string;
  datetime: string;
  lead_day: number;
  confidence: number;
  confidence_label: string;
  skill_score: number;
  agreement_score: number;
  lead_score: number;
  dominant_model: string;
  explanation: string;
}

export interface SkillMetric {
  period: string;
  blended: number;
  ai: number;
  nwpA: number;
  nwpB: number;
  ensemble: number;
}

export type RpiPriority = 'Low' | 'Moderate' | 'High' | 'Critical';
export type HazardTierLevel = 'Green' | 'Yellow' | 'Orange' | 'Red';

export const SEVERITY_PALETTE: Record<
  HazardTierLevel,
  {
    name: string;
    strokeColor: string;
    bgBadge: string;
    textBadge: string;
    borderBadge: string;
    glow: string;
    label: string;
    sublabel: string;
  }
> = {
  Green: {
    name: 'Green',
    strokeColor: '#10b981',
    bgBadge: 'bg-emerald-500/15',
    textBadge: 'text-emerald-700',
    borderBadge: 'border-emerald-500/30',
    glow: 'rgba(16, 185, 129, 0.25)',
    label: 'HAZARD LEVEL 1 (GREEN) · ROUTINE',
    sublabel: 'Routine Surveillance · All Parameters Normal',
  },
  Yellow: {
    name: 'Yellow',
    strokeColor: '#f59e0b',
    bgBadge: 'bg-amber-500/15',
    textBadge: 'text-amber-700',
    borderBadge: 'border-amber-500/30',
    glow: 'rgba(245, 158, 11, 0.25)',
    label: 'HAZARD LEVEL 2 (YELLOW) · MODERATE',
    sublabel: 'Heightened Watch · Localized Mitigation Standby',
  },
  Orange: {
    name: 'Orange',
    strokeColor: '#f97316',
    bgBadge: 'bg-orange-500/15',
    textBadge: 'text-orange-700',
    borderBadge: 'border-orange-500/30',
    glow: 'rgba(249, 115, 22, 0.30)',
    label: 'HAZARD LEVEL 3 (ORANGE) · HIGH ALERT',
    sublabel: 'Urgent Action Mandated · Field Units Mobilized',
  },
  Red: {
    name: 'Red',
    strokeColor: '#ef4444',
    bgBadge: 'bg-red-500/20',
    textBadge: 'text-red-700',
    borderBadge: 'border-red-500/40',
    glow: 'rgba(239, 68, 68, 0.35)',
    label: 'HAZARD LEVEL 4 (RED) · CRITICAL EMERGENCY',
    sublabel: 'Tier-1 Emergency · SDRF / NDRF Pre-Positioning Active',
  },
};

export interface ResourceAction {
  id: string;
  title: string;
  description: string;
  category: 'rain' | 'heat' | 'wind' | 'general';
  priority: 'critical' | 'high' | 'medium' | 'routine';
  department: string;
  status: 'Ready' | 'Standby' | 'Dispatched' | 'Active';
  actionCode: string;
  estimatedResources?: Record<string, number | string>;
}

export interface RpiData {
  city: string;
  state: string;
  lat: number;
  lon: number;
  rainfall: number;
  temperature: number;
  wind: number;
  confidence: number;
  rainRisk: number;
  heatRisk: number;
  windRisk: number;
  rpi?: number;
  rpiScore: number;
  tierLevel?: HazardTierLevel;
  actionTier?: string;
  confidenceBadge?: string | null;
  actionDirective?: string;
  priority: RpiPriority;
  dominantModel: string;
  modelWeights: {
    ecmwf: number;
    icon: number;
    gfs: number;
    gem: number;
  };
  recommendations: ResourceAction[];
  updatedAt: string;
}

export interface PerformanceSummaryRecord {
  variable: string;
  lead_days: number;
  method: string;
  rmse: number;
  mae: number;
}
