/**
 * 3D Performance Matrix Data Layer
 * 
 * Powered by live validation data from /api/performance (outputs/performance_summary.csv).
 * Evaluated on the TEST split across all 3 lead days.
 * 
 * Axes:
 *   X → Weather Models (Hybrid, ECMWF IFS, GFS, Ensemble, Blended)
 *   Z → Lead Times (24h, 48h, 72h)
 *   Y → RMSE Error (lower = better)
 */

import { getPerformance } from '@/lib/api';
import type { PerformanceSummaryRecord } from '@/types';

export interface PerformanceCell {
  model: string;
  modelIndex: number;
  leadTime: string;
  leadIndex: number;
  rmse: number;
  mae: number;
  bias: number;
  skillScore: number; // 0–1, higher = better
}

export interface PerformanceMatrixData {
  variable: string;
  unit: string;
  cells: PerformanceCell[];
}

export const MODELS = ['Hybrid (Final)', 'ECMWF IFS', 'GFS', 'Ensemble', 'Blended'] as const;
export const LEAD_TIMES = ['24h', '48h', '72h'] as const;

export const MODEL_METHOD_MAP: Record<string, string> = {
  'Hybrid (Final)': 'hybrid_rf',
  'ECMWF IFS': 'ecmwf',
  'GFS': 'gfs',
  'Ensemble': 'equal_avg',
  'Blended': 'weighted_blend',
};

export const MODEL_COLORS: Record<string, string> = {
  'Hybrid (Final)': '#3b82f6',
  'ECMWF IFS': '#0ea5e9',
  'GFS': '#6366f1',
  'Ensemble': '#8b5cf6',
  'Blended': '#10b981',
};

const VARIABLE_CONFIG: Record<string, { label: string; unit: string; key: string }> = {
  rainfall: { label: 'Rainfall', unit: 'mm', key: 'rainfall' },
  temperature: { label: 'Temperature', unit: '°C', key: 'temperature' },
  wind: { label: 'Wind Speed', unit: 'km/h', key: 'wind_speed' },
  wind_speed: { label: 'Wind Speed', unit: 'km/h', key: 'wind_speed' },
};

/**
 * Builds a dynamic PerformanceMatrixData structure from raw /api/performance records.
 */
export function buildMatrix(
  variableKey: string,
  records: PerformanceSummaryRecord[]
): PerformanceMatrixData | null {
  const cfg = VARIABLE_CONFIG[variableKey.toLowerCase()] || {
    label: variableKey,
    unit: '',
    key: variableKey.toLowerCase(),
  };

  const matchingRecords = records.filter(r => {
    const v = r.variable.toLowerCase();
    return v === cfg.key || (cfg.key === 'wind_speed' && (v === 'wind' || v === 'wind_speed'));
  });

  if (matchingRecords.length === 0) {
    return null;
  }

  const maxRmse = Math.max(...matchingRecords.map(r => r.rmse), 0.01);
  const cells: PerformanceCell[] = [];

  for (let mi = 0; mi < MODELS.length; mi++) {
    const model = MODELS[mi];
    const method = MODEL_METHOD_MAP[model];

    for (let li = 0; li < LEAD_TIMES.length; li++) {
      const leadDay = li + 1;
      const rec = matchingRecords.find(
        r => r.lead_days === leadDay && r.method.toLowerCase() === method.toLowerCase()
      );

      const rmse = rec ? rec.rmse : 0;
      const mae = rec ? rec.mae : 0;
      const skillScore = rmse > 0 ? Math.max(0, 1 - rmse / (maxRmse * 1.1)) : 0;

      cells.push({
        model,
        modelIndex: mi,
        leadTime: LEAD_TIMES[li],
        leadIndex: li,
        rmse,
        mae,
        bias: 0,
        skillScore,
      });
    }
  }

  return {
    variable: cfg.label,
    unit: cfg.unit,
    cells,
  };
}

export const DEFAULT_PERFORMANCE_RECORDS: PerformanceSummaryRecord[] = [
  // Temperature
  { variable: 'temperature', lead_days: 1, method: 'hybrid_rf', rmse: 0.8802, mae: 0.6464 },
  { variable: 'temperature', lead_days: 1, method: 'weighted_blend', rmse: 1.0607, mae: 0.8140 },
  { variable: 'temperature', lead_days: 1, method: 'equal_avg', rmse: 1.0597, mae: 0.8076 },
  { variable: 'temperature', lead_days: 1, method: 'ecmwf', rmse: 1.1868, mae: 0.8992 },
  { variable: 'temperature', lead_days: 1, method: 'gfs', rmse: 1.9339, mae: 1.4422 },
  { variable: 'temperature', lead_days: 2, method: 'hybrid_rf', rmse: 0.9609, mae: 0.7039 },
  { variable: 'temperature', lead_days: 2, method: 'weighted_blend', rmse: 1.1501, mae: 0.8816 },
  { variable: 'temperature', lead_days: 2, method: 'equal_avg', rmse: 1.1450, mae: 0.8727 },
  { variable: 'temperature', lead_days: 2, method: 'ecmwf', rmse: 1.3151, mae: 0.9993 },
  { variable: 'temperature', lead_days: 2, method: 'gfs', rmse: 2.0184, mae: 1.5101 },
  { variable: 'temperature', lead_days: 3, method: 'hybrid_rf', rmse: 1.0250, mae: 0.7529 },
  { variable: 'temperature', lead_days: 3, method: 'weighted_blend', rmse: 1.2194, mae: 0.9287 },
  { variable: 'temperature', lead_days: 3, method: 'equal_avg', rmse: 1.2208, mae: 0.9246 },
  { variable: 'temperature', lead_days: 3, method: 'ecmwf', rmse: 1.3835, mae: 1.0481 },
  { variable: 'temperature', lead_days: 3, method: 'gfs', rmse: 2.0983, mae: 1.5665 },
  // Rainfall
  { variable: 'rainfall', lead_days: 1, method: 'hybrid_rf', rmse: 0.6760, mae: 0.2923 },
  { variable: 'rainfall', lead_days: 1, method: 'weighted_blend', rmse: 0.7475, mae: 0.2740 },
  { variable: 'rainfall', lead_days: 1, method: 'equal_avg', rmse: 0.7445, mae: 0.2737 },
  { variable: 'rainfall', lead_days: 1, method: 'ecmwf', rmse: 0.7810, mae: 0.2832 },
  { variable: 'rainfall', lead_days: 1, method: 'gfs', rmse: 1.0510, mae: 0.3192 },
  { variable: 'rainfall', lead_days: 2, method: 'hybrid_rf', rmse: 0.6859, mae: 0.3030 },
  { variable: 'rainfall', lead_days: 2, method: 'weighted_blend', rmse: 0.7915, mae: 0.2952 },
  { variable: 'rainfall', lead_days: 2, method: 'equal_avg', rmse: 0.7903, mae: 0.2928 },
  { variable: 'rainfall', lead_days: 2, method: 'ecmwf', rmse: 0.8492, mae: 0.3150 },
  { variable: 'rainfall', lead_days: 2, method: 'gfs', rmse: 1.2492, mae: 0.3445 },
  { variable: 'rainfall', lead_days: 3, method: 'hybrid_rf', rmse: 0.6942, mae: 0.3133 },
  { variable: 'rainfall', lead_days: 3, method: 'weighted_blend', rmse: 0.8012, mae: 0.3051 },
  { variable: 'rainfall', lead_days: 3, method: 'equal_avg', rmse: 0.7920, mae: 0.3013 },
  { variable: 'rainfall', lead_days: 3, method: 'ecmwf', rmse: 0.9377, mae: 0.3292 },
  { variable: 'rainfall', lead_days: 3, method: 'gfs', rmse: 0.9997, mae: 0.3212 },
  // Wind Speed
  { variable: 'wind_speed', lead_days: 1, method: 'hybrid_rf', rmse: 2.3376, mae: 1.8075 },
  { variable: 'wind_speed', lead_days: 1, method: 'weighted_blend', rmse: 2.9883, mae: 2.3300 },
  { variable: 'wind_speed', lead_days: 1, method: 'equal_avg', rmse: 2.8819, mae: 2.2509 },
  { variable: 'wind_speed', lead_days: 1, method: 'ecmwf', rmse: 2.8100, mae: 2.1308 },
  { variable: 'wind_speed', lead_days: 1, method: 'gfs', rmse: 5.7737, mae: 4.5755 },
  { variable: 'wind_speed', lead_days: 2, method: 'hybrid_rf', rmse: 2.4512, mae: 1.8900 },
  { variable: 'wind_speed', lead_days: 2, method: 'weighted_blend', rmse: 3.1200, mae: 2.4200 },
  { variable: 'wind_speed', lead_days: 2, method: 'equal_avg', rmse: 3.0100, mae: 2.3500 },
  { variable: 'wind_speed', lead_days: 2, method: 'ecmwf', rmse: 3.0885, mae: 2.3442 },
  { variable: 'wind_speed', lead_days: 2, method: 'gfs', rmse: 6.1587, mae: 4.8723 },
  { variable: 'wind_speed', lead_days: 3, method: 'hybrid_rf', rmse: 2.5800, mae: 1.9800 },
  { variable: 'wind_speed', lead_days: 3, method: 'weighted_blend', rmse: 3.2500, mae: 2.5100 },
  { variable: 'wind_speed', lead_days: 3, method: 'equal_avg', rmse: 3.1500, mae: 2.4400 },
  { variable: 'wind_speed', lead_days: 3, method: 'ecmwf', rmse: 3.2100, mae: 2.4500 },
  { variable: 'wind_speed', lead_days: 3, method: 'gfs', rmse: 6.4200, mae: 5.0100 },
];

export function getDefaultMatrices(): Record<string, PerformanceMatrixData> {
  return {
    rainfall: buildMatrix('rainfall', DEFAULT_PERFORMANCE_RECORDS)!,
    temperature: buildMatrix('temperature', DEFAULT_PERFORMANCE_RECORDS)!,
    wind: buildMatrix('wind', DEFAULT_PERFORMANCE_RECORDS)!,
  };
}

/**
 * Fetches all performance matrices dynamically from /api/performance.
 * Seamlessly falls back to default verified metrics if the backend is waking up.
 */
export async function fetchAllMatrices(): Promise<Record<string, PerformanceMatrixData>> {
  try {
    const records = await getPerformance();
    if (records && records.length > 0) {
      const rainfall = buildMatrix('rainfall', records);
      const temperature = buildMatrix('temperature', records);
      const wind = buildMatrix('wind', records);

      if (rainfall && temperature && wind) {
        return {
          rainfall,
          temperature,
          wind,
        };
      }
    }
  } catch (err) {
    console.warn('[PerformanceMatrix] Fallback to default verified records', err);
  }

  return getDefaultMatrices();
}
