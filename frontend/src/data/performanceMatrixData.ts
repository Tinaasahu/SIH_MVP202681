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

/**
 * Fetches all performance matrices dynamically from /api/performance.
 * Returns null if the endpoint fails or records are empty (no mock fallback).
 */
export async function fetchAllMatrices(): Promise<Record<string, PerformanceMatrixData> | null> {
  const records = await getPerformance();
  if (!records || records.length === 0) {
    return null;
  }

  const rainfall = buildMatrix('rainfall', records);
  const temperature = buildMatrix('temperature', records);
  const wind = buildMatrix('wind', records);

  if (!rainfall || !temperature || !wind) {
    return null;
  }

  return {
    rainfall,
    temperature,
    wind,
  };
}
