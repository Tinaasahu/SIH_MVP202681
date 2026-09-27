/**
 * 3D Performance Matrix Data
 * 
 * Axes:
 *   X → Weather Models (AI, ECMWF IFS, GFS, Ensemble, Blended)
 *   Z → Lead Times (6h, 12h, 24h, 48h, 72h)
 *   Y → RMSE Error (lower = better)
 *
 * Each variable (rainfall, temperature, wind) has its own dataset.
 * Values are realistic RMSE ranges for Indian Monsoon forecasting.
 */

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

export const MODELS = ['AI Model', 'ECMWF IFS', 'GFS', 'Ensemble', 'Blended'] as const;
export const LEAD_TIMES = ['6h', '12h', '24h', '48h', '72h'] as const;

export const MODEL_COLORS: Record<string, string> = {
  'AI Model': '#3b82f6',
  'ECMWF IFS': '#0ea5e9',
  'GFS': '#6366f1',
  'Ensemble': '#8b5cf6',
  'Blended': '#10b981',
};

const buildMatrix = (
  variable: string,
  unit: string,
  baseRMSE: number[][],  // [model][lead]
  baseMae: number[][],
  baseBias: number[][],
): PerformanceMatrixData => {
  const cells: PerformanceCell[] = [];
  const maxRmse = Math.max(...baseRMSE.flat());

  for (let mi = 0; mi < MODELS.length; mi++) {
    for (let li = 0; li < LEAD_TIMES.length; li++) {
      cells.push({
        model: MODELS[mi],
        modelIndex: mi,
        leadTime: LEAD_TIMES[li],
        leadIndex: li,
        rmse: baseRMSE[mi][li],
        mae: baseMae[mi][li],
        bias: baseBias[mi][li],
        skillScore: Math.max(0, 1 - baseRMSE[mi][li] / (maxRmse * 1.1)),
      });
    }
  }

  return { variable, unit, cells };
};

// Rainfall RMSE (mm) — models × lead times
export const RAINFALL_MATRIX = buildMatrix(
  'Rainfall', 'mm',
  // RMSE: AI, ECMWF, GFS, Ensemble, Blended
  [
    [4.2, 5.8, 8.1, 12.4, 18.6],   // AI Model
    [3.8, 5.2, 7.6, 11.8, 17.2],   // ECMWF IFS
    [5.1, 6.8, 9.4, 14.1, 20.8],   // GFS
    [4.6, 6.2, 8.8, 13.2, 19.4],   // Ensemble
    [3.2, 4.5, 6.8, 10.6, 15.8],   // Blended (best)
  ],
  // MAE
  [
    [3.1, 4.2, 6.0, 9.2, 14.1],
    [2.8, 3.9, 5.6, 8.8, 13.0],
    [3.8, 5.1, 7.1, 10.6, 15.8],
    [3.4, 4.6, 6.5, 9.8, 14.8],
    [2.4, 3.3, 5.0, 7.9, 12.0],
  ],
  // Bias
  [
    [-0.8, -1.2, -2.1, -3.4, -5.2],
    [0.4, 0.8, 1.4, 2.2, 3.6],
    [1.2, 1.8, 2.8, 4.2, 6.4],
    [0.2, 0.4, 0.6, 1.0, 1.6],
    [-0.1, -0.2, -0.4, -0.6, -1.0],
  ],
);

export const TEMPERATURE_MATRIX = buildMatrix(
  'Temperature', '°C',
  [
    [0.8, 1.1, 1.6, 2.4, 3.5],
    [0.7, 1.0, 1.4, 2.1, 3.2],
    [1.0, 1.3, 1.9, 2.8, 4.1],
    [0.9, 1.2, 1.7, 2.6, 3.8],
    [0.6, 0.8, 1.2, 1.8, 2.8],
  ],
  [
    [0.6, 0.8, 1.2, 1.8, 2.7],
    [0.5, 0.7, 1.0, 1.6, 2.4],
    [0.8, 1.0, 1.4, 2.1, 3.1],
    [0.7, 0.9, 1.3, 2.0, 2.9],
    [0.4, 0.6, 0.9, 1.4, 2.1],
  ],
  [
    [-0.2, -0.3, -0.4, -0.6, -0.9],
    [0.1, 0.2, 0.3, 0.5, 0.8],
    [0.3, 0.4, 0.6, 0.9, 1.4],
    [0.1, 0.1, 0.2, 0.3, 0.4],
    [0.0, -0.1, -0.1, -0.2, -0.3],
  ],
);

export const WIND_MATRIX = buildMatrix(
  'Wind Speed', 'km/h',
  [
    [1.8, 2.4, 3.4, 5.2, 7.8],
    [1.6, 2.2, 3.1, 4.8, 7.2],
    [2.2, 2.9, 4.1, 6.2, 9.1],
    [2.0, 2.6, 3.7, 5.6, 8.4],
    [1.4, 1.9, 2.7, 4.2, 6.4],
  ],
  [
    [1.4, 1.8, 2.6, 4.0, 6.0],
    [1.2, 1.7, 2.4, 3.7, 5.5],
    [1.7, 2.2, 3.1, 4.8, 7.0],
    [1.5, 2.0, 2.8, 4.3, 6.5],
    [1.0, 1.4, 2.0, 3.2, 4.9],
  ],
  [
    [-0.4, -0.6, -0.9, -1.4, -2.1],
    [0.2, 0.4, 0.6, 1.0, 1.5],
    [0.6, 0.8, 1.2, 1.8, 2.8],
    [0.1, 0.2, 0.3, 0.5, 0.7],
    [0.0, -0.1, -0.1, -0.2, -0.4],
  ],
);

export const ALL_MATRICES: Record<string, PerformanceMatrixData> = {
  rainfall: RAINFALL_MATRIX,
  temperature: TEMPERATURE_MATRIX,
  wind: WIND_MATRIX,
};
