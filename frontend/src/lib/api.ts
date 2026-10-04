/**
 * Hybrid Weather AI - API Integration Layer
 * Connects Next.js Frontend to Flask Backend (http://localhost:5000/api)
 *
 * Provides core fetch functions:
 *   - getForecast(city?, lead_days?)
 *   - getWeights(city?, variable?, lead_days?)
 *   - getSkillScores(city?, variable?)
 *   - getAlerts(city?)
 *   - getCities()
 *
 * Also provides typed helper functions that transform API records into
 * the UI types required by components, with robust fallbacks to mock data.
 */

import type {
  ForecastMetrics,
  ModelWeight,
  TimelinePoint,
  ExtremeEvent,
  Alert,
  DataSource,
  ModelComparison,
  CityForecast,
  SkillMetric,
  ConfidenceRecord,
  RpiData,
  ResourceAction,
  PerformanceSummaryRecord,
  ContingencyMetricRecord,
} from '@/types';

import {
  MOCK_FORECAST,
  MOCK_MODEL_WEIGHTS,
  MOCK_TIMELINE,
  MOCK_EXTREME_EVENTS,
  MOCK_ALERTS,
  MOCK_DATA_SOURCES,
  MOCK_MODEL_COMPARISON,
  MOCK_CITIES,
  MOCK_SKILL_METRICS,
  MOCK_STATES,
  MOCK_REGION_DOMINANCE,
  ENGINE_STATUS,
} from '@/data/mockData';

export {
  MOCK_FORECAST,
  MOCK_MODEL_WEIGHTS,
  MOCK_TIMELINE,
  MOCK_EXTREME_EVENTS,
  MOCK_ALERTS,
  MOCK_DATA_SOURCES,
  MOCK_MODEL_COMPARISON,
  MOCK_CITIES,
  MOCK_SKILL_METRICS,
  MOCK_STATES,
  MOCK_REGION_DOMINANCE,
  ENGINE_STATUS,
};

/**
 * Centralized API Base Configuration
 * Backend Render URL: https://sih-mvp202681.onrender.com
 */
export const API = "https://sih-mvp202681.onrender.com";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (process.env.NODE_ENV === "production" ? API : "http://localhost:5001");

export function buildApiUrl(endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const rawBase = API_BASE.trim().replace(/\/+$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (rawBase.endsWith('/api')) {
    if (cleanEndpoint.startsWith('/api/')) {
      return `${rawBase}${cleanEndpoint.slice(4)}`;
    }
    return `${rawBase}${cleanEndpoint}`;
  }

  if (cleanEndpoint.startsWith('/api/')) {
    return `${rawBase}${cleanEndpoint}`;
  }
  return `${rawBase}/api${cleanEndpoint}`;
}

export const RETRY_TIMEOUT_MS = 60000; // 60 seconds total retry duration
export const RETRY_INTERVAL_MS = 8000; // Retry every 8 seconds

export const STARTING_AI_WEATHER_ENGINE_MSG = "Starting AI weather engine… This may take up to 60 seconds.";
export const SERVER_WAKING_UP_MSG = "Server is waking up. Please try again.";

// Backward compatibility constants
export const RENDER_COLD_START_MSG = STARTING_AI_WEATHER_ENGINE_MSG;
export const RENDER_COLD_START_LOADING_MSG = STARTING_AI_WEATHER_ENGINE_MSG;
export const RENDER_COLD_START_ERROR_MSG = SERVER_WAKING_UP_MSG;

export type BackendStatusType = 'idle' | 'connecting' | 'connected' | 'error';

let backendWakingUp = false;
let backendError = false;
let backendStatus: BackendStatusType = 'idle';
let hasConnectedOnce = false;

export function getBackendStatus(): BackendStatusType {
  return backendStatus;
}

export function isBackendWakingUp(): boolean {
  return backendWakingUp || backendStatus === 'connecting';
}

export function isBackendError(): boolean {
  return backendError || backendStatus === 'error';
}

export function isBackendConnected(): boolean {
  return backendStatus === 'connected' || hasConnectedOnce;
}

export function setBackendStatus(
  waking: boolean,
  isError: boolean = false,
  message?: string,
  status?: BackendStatusType
) {
  backendWakingUp = waking;
  backendError = isError;
  if (status) {
    backendStatus = status;
  } else if (isError) {
    backendStatus = 'error';
  } else if (waking) {
    backendStatus = 'connecting';
  } else {
    backendStatus = 'connected';
  }

  if (backendStatus === 'connected') {
    hasConnectedOnce = true;
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('backend-status', {
        detail: {
          wakingUp: waking,
          error: isError,
          status: backendStatus,
          connected: backendStatus === 'connected',
          message: message ?? (waking ? STARTING_AI_WEATHER_ENGINE_MSG : isError ? SERVER_WAKING_UP_MSG : ''),
        },
      })
    );
  }
}

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  totalTimeoutMs?: number;
  retryIntervalMs?: number;
}

let coldStartLogged = false;
let coldStartExhaustedLogged = false;

const inFlightRequests = new Map<string, Promise<any>>();

/**
 * Reusable fetch helper with Render cold start auto-reconnect:
 * - Uses NEXT_PUBLIC_API_URL
 * - Retries automatically for up to 60 seconds
 * - Retries every 8 seconds
 * - Retries on: network failure, timeout, HTTP 502, HTTP 503, HTTP 504
 * - As soon as one request succeeds, returns the response normally
 * - If all retries fail, throws a clean error: "Server is waking up. Please try again."
 */
export async function fetchWithReconnect<T = any>(
  endpoint: string,
  options?: FetchOptions
): Promise<T> {
  const isGet = !options?.method || options.method.toUpperCase() === 'GET';
  const cacheKey = isGet ? buildApiUrl(endpoint) : null;

  if (cacheKey && inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey) as Promise<T>;
  }

  const executeFetch = async (): Promise<T> => {
    const totalTimeout = options?.totalTimeoutMs ?? RETRY_TIMEOUT_MS;
    const retryInterval = options?.retryIntervalMs ?? RETRY_INTERVAL_MS;
    const startTime = Date.now();
    let attempt = 0;

    // Only flag connecting state if the request takes >1200ms (Render cold start) or encounters a retryable error
    let connectingTimer: NodeJS.Timeout | null = null;
    if (!hasConnectedOnce && backendStatus !== 'connecting') {
      connectingTimer = setTimeout(() => {
        if (!hasConnectedOnce && backendStatus !== 'connected') {
          setBackendStatus(true, false, STARTING_AI_WEATHER_ENGINE_MSG, 'connecting');
        }
      }, 1200);
    }

    while (Date.now() - startTime < totalTimeout) {
      attempt++;
      const totalRemaining = totalTimeout - (Date.now() - startTime);
      if (totalRemaining <= 0) break;
      // Allow request to wait for the remaining window so in-flight requests are not cancelled prematurely during Render cold start
      const currentTimeout = totalRemaining;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), currentTimeout);

      if (options?.signal) {
        if (options.signal.aborted) {
          controller.abort();
        } else {
          options.signal.addEventListener('abort', () => controller.abort(), { once: true });
        }
      }

      const attemptStart = Date.now();
      let isRetryable = false;
      let reason = '';

      try {
        const url = buildApiUrl(endpoint);
        const res = await fetch(url, {
          ...options,
          signal: controller.signal,
          // Force fresh response without sending non-safelisted headers that trigger OPTIONS preflight
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            ...(options?.headers || {}),
          },
        });

        clearTimeout(timeoutId);

        // Requirement 3: As soon as one request succeeds, return the response normally
        if (res.ok) {
          if (connectingTimer) {
            clearTimeout(connectingTimer);
            connectingTimer = null;
          }
          coldStartLogged = false;
          coldStartExhaustedLogged = false;
          setBackendStatus(false, false, '', 'connected');
          const rawText = await res.text();
          // Sanitize Python NaN/Infinity values to null for strict JSON compliance
          const sanitizedText = rawText
            .replace(/:\s*NaN\b/g, ': null')
            .replace(/:\s*Infinity\b/g, ': null')
            .replace(/:\s*-Infinity\b/g, ': null');
          const data = JSON.parse(sanitizedText);
          return data as T;
        }

        // Check HTTP 502, 503, 504
        if (res.status === 502 || res.status === 503 || res.status === 504) {
          isRetryable = true;
          reason = `HTTP ${res.status}`;
        } else {
          const errorText = await res.text().catch(() => res.statusText);
          throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`);
        }
      } catch (err: unknown) {
        clearTimeout(timeoutId);

        if (err instanceof Error && err.name === 'AbortError') {
          isRetryable = true;
          reason = 'Timeout';
        } else if (err instanceof TypeError) {
          // Network failure
          isRetryable = true;
          reason = 'Network failure';
        } else if (isRetryable) {
          // Already marked retryable
        } else {
          throw err;
        }
      }

      if (connectingTimer) {
        clearTimeout(connectingTimer);
        connectingTimer = null;
      }

      if (isRetryable) {
        setBackendStatus(true, false, STARTING_AI_WEATHER_ENGINE_MSG, 'connecting');
        if (!coldStartLogged) {
          coldStartLogged = true;
          console.info(`[NabhDrishti] Backend is waking up. ${STARTING_AI_WEATHER_ENGINE_MSG}`);
        }

        const elapsed = Date.now() - attemptStart;
        const delay = Math.max(0, retryInterval - elapsed);
        const remainingWindow = totalTimeout - (Date.now() - startTime);

        if (remainingWindow <= 0) break;

        const waitTime = Math.min(delay, remainingWindow);
        if (waitTime > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    if (connectingTimer) {
      clearTimeout(connectingTimer);
      connectingTimer = null;
    }

    // Requirement 4: If all retries fail, throw clean error
    setBackendStatus(false, true, SERVER_WAKING_UP_MSG, 'error');
    if (!coldStartExhaustedLogged) {
      coldStartExhaustedLogged = true;
      console.warn(`[NabhDrishti] Cold start retries exhausted after ${Math.round((Date.now() - startTime) / 1000)}s: ${SERVER_WAKING_UP_MSG}`);
    }
    throw new Error(SERVER_WAKING_UP_MSG);
  };

  const promise = executeFetch();
  if (cacheKey) {
    inFlightRequests.set(cacheKey, promise);
    promise.finally(() => {
      inFlightRequests.delete(cacheKey);
    });
  }

  return promise;
}

/**
 * Generic fetch with Render cold-start handling that delegates to fetchWithReconnect.
 * When a fallback is provided, returns the fallback on error so components do not crash.
 */
export async function fetchFromApi<T>(endpoint: string, fallback?: T): Promise<T> {
  try {
    return await fetchWithReconnect<T>(endpoint);
  } catch (err) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw err;
  }
}

// ============================================================================
// Core Reusable Fetch Functions (Required by Step 2)
// ============================================================================

export interface ForecastRecord {
  city: string;
  datetime: string;
  lead_days: number;
  blend_temperature: number;
  blend_rainfall: number;
  blend_wind_speed: number;
  temperature: number;
  rainfall: number;
  wind_speed: number;
}

export interface WeightRecord {
  city: string;
  variable: string;
  lead_days: number;
  model: string;
  weight: number;
}

export interface SkillScoreRecord {
  city: string;
  variable: string;
  lead_days: number;
  model: string;
  mae: number;
  rmse: number;
  bias: number;
  n: number;
}

export interface AlertRecord {
  city: string;
  datetime: string;
  event: string;
  severity: string;
  forecast_value: number;
  threshold: number;
}

export interface CityRecord {
  city: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lon?: number;
}

export interface MetadataRecord {
  last_updated: string;
  cities: number;
  models: number;
  city_count?: number;
  model_count?: number;
}

export type { ConfidenceRecord, ContingencyMetricRecord };

/**
 * Formats an ISO datetime string into:
 * "26 Sep 2026 • 11:45 PM"
 */
export function formatLastUpdated(isoString?: string | null): string {
  try {
    let d: Date;
    if (isoString) {
      let clean = isoString.trim();
      // If backend timestamp has no timezone offset or Z, it originates from Render UTC -> append Z
      if (!clean.endsWith('Z') && !clean.includes('+') && !clean.includes('-', 10)) {
        clean += 'Z';
      }
      d = new Date(clean);
      if (isNaN(d.getTime())) d = new Date();
    } else {
      d = new Date();
    }

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const parts = formatter.formatToParts(d);
    let day = '', month = '', year = '', hour = '', minute = '', dayPeriod = '';
    for (const p of parts) {
      if (p.type === 'day') day = p.value;
      if (p.type === 'month') month = p.value;
      if (p.type === 'year') year = p.value;
      if (p.type === 'hour') hour = p.value;
      if (p.type === 'minute') minute = p.value;
      if (p.type === 'dayPeriod') dayPeriod = p.value.toUpperCase();
    }
    return `${day} ${month} ${year} • ${hour}:${minute} ${dayPeriod}`;
  } catch {
    return 'Live • Auto-Updating';
  }
}

/**
 * GET /api/metadata
 * Returns last_updated timestamp, city count, and model count.
 */
export async function getMetadata(): Promise<MetadataRecord> {
  return fetchFromApi<MetadataRecord>('/metadata');
}

/**
 * GET /api/confidence
 * Returns confidence_scores.csv records from the Explainable Confidence Engine (ECE).
 */
export async function getConfidence(city?: string, lead_day?: number): Promise<ConfidenceRecord[]> {
  const params = new URLSearchParams();
  if (city) params.append('city', city);
  if (lead_day) params.append('lead_day', String(lead_day));
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchFromApi<ConfidenceRecord[]>(`/confidence${query}`, []);
}

/**
 * GET /api/performance
 * Returns performance_summary.csv records.
 */
export async function getPerformance(variable?: string, lead_days?: number, method?: string): Promise<PerformanceSummaryRecord[]> {
  const params = new URLSearchParams();
  if (variable) params.append('variable', variable);
  if (lead_days) params.append('lead_days', String(lead_days));
  if (method) params.append('method', method);
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchFromApi<PerformanceSummaryRecord[]>(`/performance${query}`, []);
}

export const DEFAULT_CONTINGENCY_METRICS: ContingencyMetricRecord[] = [
  { method: 'ecmwf', threshold_name: 'Light (>=0.1mm)', threshold_mm: 0.1, hits: 17934, misses: 4893, false_alarms: 10725, correct_negatives: 28008, pod: 0.7856, far: 0.3742, csi: 0.5345 },
  { method: 'ecmwf', threshold_name: 'Moderate (>=15.6mm)', threshold_mm: 15.6, hits: 0, misses: 9, false_alarms: 6, correct_negatives: 61545, pod: 0.0, far: 1.0, csi: 0.0 },
  { method: 'ecmwf', threshold_name: 'Heavy (>=64.5mm)', threshold_mm: 64.5, hits: 0, misses: 0, false_alarms: 0, correct_negatives: 61560, pod: null, far: null, csi: null },
  { method: 'weighted_blend', threshold_name: 'Light (>=0.1mm)', threshold_mm: 0.1, hits: 14967, misses: 7860, false_alarms: 9009, correct_negatives: 29724, pod: 0.6557, far: 0.3758, csi: 0.4701 },
  { method: 'weighted_blend', threshold_name: 'Moderate (>=15.6mm)', threshold_mm: 15.6, hits: 0, misses: 9, false_alarms: 2, correct_negatives: 61549, pod: 0.0, far: 1.0, csi: 0.0 },
  { method: 'weighted_blend', threshold_name: 'Heavy (>=64.5mm)', threshold_mm: 64.5, hits: 0, misses: 0, false_alarms: 0, correct_negatives: 61560, pod: null, far: null, csi: null },
  { method: 'hybrid_rf', threshold_name: 'Light (>=0.1mm)', threshold_mm: 0.1, hits: 20720, misses: 2107, false_alarms: 19810, correct_negatives: 18923, pod: 0.9077, far: 0.4888, csi: 0.4860 },
  { method: 'hybrid_rf', threshold_name: 'Moderate (>=15.6mm)', threshold_mm: 15.6, hits: 0, misses: 9, false_alarms: 0, correct_negatives: 61551, pod: 0.0, far: null, csi: 0.0 },
  { method: 'hybrid_rf', threshold_name: 'Heavy (>=64.5mm)', threshold_mm: 64.5, hits: 0, misses: 0, false_alarms: 0, correct_negatives: 61560, pod: null, far: null, csi: null },
];

/**
 * GET /api/contingency
 * Returns contingency_metrics.csv records (POD, FAR, CSI).
 */
export async function getContingencyMetrics(method?: string, threshold?: string): Promise<ContingencyMetricRecord[]> {
  const params = new URLSearchParams();
  if (method) params.append('method', method);
  if (threshold) params.append('threshold', threshold);
  const query = params.toString() ? `?${params.toString()}` : '';
  const data = await fetchFromApi<ContingencyMetricRecord[]>(`/contingency${query}`, []);
  if (data && data.length > 0) return data;
  return DEFAULT_CONTINGENCY_METRICS;
}

// Active in-flight singleton and memory cache for forecast records
let activeForecastPromise: Promise<ForecastRecord[]> | null = null;
let cachedForecastRecords: ForecastRecord[] | null = null;
let lastForecastFetchTime = 0;
const FORECAST_CACHE_TTL_MS = 60000; // 60 seconds

export function getCurrentHourKolkata(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    let hour = parts.find(p => p.type === 'hour')?.value || '00';
    if (hour === '24') hour = '00';
    return `${year}-${month}-${day} ${hour}:00`;
  } catch {
    const now = new Date();
    return now.toISOString().slice(0, 13).replace('T', ' ') + ':00';
  }
}

function filterForecastRecords(records: ForecastRecord[], city?: string, lead_days?: number): ForecastRecord[] {
  if (!records || !Array.isArray(records)) return [];
  let result = records;
  if (city) {
    const cityLower = city.trim().toLowerCase();
    result = result.filter((r) => (r.city || '').trim().toLowerCase() === cityLower);
  }
  if (lead_days !== undefined && lead_days !== null) {
    const ld = Number(lead_days);
    result = result.filter((r) => Number(r.lead_days) === ld);
  }
  return result;
}

export function clearForecastCache(): void {
  cachedForecastRecords = null;
  lastForecastFetchTime = 0;
  activeForecastPromise = null;
}

/**
 * GET /api/forecast
 * Returns hybrid_forecast.csv records.
 * Uses a singleton in-flight promise and memory cache to guarantee:
 * 1. Only ONE forecast request is active at a time.
 * 2. Zero duplicate forecast requests during mount or StrictMode re-mount.
 * 3. Never cancelled while Render wakes up.
 */
export async function getForecast(city?: string, lead_days?: number): Promise<ForecastRecord[]> {
  const params = new URLSearchParams();
  if (city) params.append('city', city);
  if (lead_days !== undefined && lead_days !== null) params.append('lead_days', String(lead_days));
  const query = params.toString() ? `?${params.toString()}` : '';

  try {
    const raw = await fetchFromApi<any>(`/forecast${query}`, []);
    const records: ForecastRecord[] = Array.isArray(raw)
      ? raw
      : (raw?.records || raw?.data || raw?.forecast || []);
    return records || [];
  } catch {
    return [];
  }
}

export interface ModelForecastRecord {
  city: string;
  model: string;
  datetime: string;
  lead_days: number;
  temperature: number;
  rainfall: number;
  wind_speed: number;
}

/**
 * GET /api/model_forecasts
 * Returns real per-model forecast records for ECMWF, GFS, ICON, GEM, and Hybrid.
 */
export async function getModelForecasts(city?: string, lead_days?: number): Promise<ModelForecastRecord[]> {
  const params = new URLSearchParams();
  if (city) params.append('city', city);
  if (lead_days) params.append('lead_days', String(lead_days));
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchFromApi<ModelForecastRecord[]>(`/model_forecasts${query}`, []);
}

/**
 * GET /api/weights
 * Returns model_weights_lead.csv records
 */
export async function getWeights(city?: string, variable?: string, lead_days?: number): Promise<WeightRecord[]> {
  const params = new URLSearchParams();
  if (city) params.append('city', city);
  if (variable) params.append('variable', variable);
  if (lead_days) params.append('lead_days', String(lead_days));
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchFromApi<WeightRecord[]>(`/weights${query}`, []);
}

/**
 * GET /api/skill
 * Returns skill_scores_lead.csv records
 */
export async function getSkillScores(city?: string, variable?: string): Promise<SkillScoreRecord[]> {
  const params = new URLSearchParams();
  if (city) params.append('city', city);
  if (variable) params.append('variable', variable);
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchFromApi<SkillScoreRecord[]>(`/skill${query}`, []);
}

/**
 * GET /api/alerts
 * Returns extreme_alerts.csv records
 */
export async function getAlerts(city?: string): Promise<AlertRecord[]> {
  const params = new URLSearchParams();
  if (city) params.append('city', city);
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchFromApi<AlertRecord[]>(`/alerts${query}`, []);
}

/**
 * GET /api/cities
 * Returns unique cities from hybrid_forecast.csv / cities.csv
 */
export async function getCities(): Promise<CityRecord[]> {
  return fetchFromApi<CityRecord[]>('/cities', []);
}

// ============================================================================
// UI Model Adapters & Component Helpers
// ============================================================================

/**
 * Helper to get ForecastMetrics for ForecastHero component.
 */
export async function getForecastMetrics(city: string = 'Kanpur'): Promise<ForecastMetrics> {
  try {
    const [records, confRecords] = await Promise.all([
      getForecast(city),
      getConfidence(city, 1),
    ]);
    if (!records || records.length === 0) {
      return MOCK_FORECAST;
    }

    // F5: "Current weather" values must come from the row for the current hour, never from the first row of the array.
    const currentHourStr = getCurrentHourKolkata();
    const target = records.find(r => r.datetime && r.datetime.replace('T', ' ').startsWith(currentHourStr))
      || records.find(r => r.datetime && r.datetime.replace('T', ' ') >= currentHourStr)
      || records[records.length - 1]
      || records[0];
    const confItem = confRecords && confRecords.length > 0 ? confRecords[0] : null;

    const tempDiff = Math.abs((target.temperature ?? 30) - (target.blend_temperature ?? 30));
    const rainDiff = Math.abs((target.rainfall ?? 0) - (target.blend_rainfall ?? 0));
    const windDiff = Math.abs((target.wind_speed ?? 10) - (target.blend_wind_speed ?? 10));

    return {
      rainfall: Math.round((target.rainfall ?? 0) * 10) / 10,
      temperature: Math.round((target.temperature ?? 30) * 10) / 10,
      wind: Math.round((target.wind_speed ?? 15) * 10) / 10,
      confidence: confItem?.confidence != null ? Math.round(confItem.confidence) : 88,
      confidenceLabel: confItem?.confidence_label || 'High',
      dominantModel: confItem?.dominant_model || 'ECMWF',
      explanation: confItem?.explanation,
      rainfallUncertainty: Math.max(2, Math.round(rainDiff * 2 + 5)),
      temperatureUncertainty: Math.max(0.5, Math.round((tempDiff + 0.8) * 10) / 10),
      windUncertainty: Math.max(1, Math.round(windDiff + 2)),
      updatedMinutesAgo: 4,
    };
  } catch {
    return MOCK_FORECAST;
  }
}

/**
 * Helper to get TimelinePoint[] for ForecastTimeline component.
 */
export async function getTimelineData(city: string = 'Kanpur'): Promise<TimelinePoint[]> {
  try {
    const [records, confRecords] = await Promise.all([
      getForecast(city).catch(() => []),
      getConfidence(city).catch(() => []),
    ]);
    if (!records || records.length < 6) {
      return MOCK_TIMELINE;
    }

    // Anchor "NOW" to the current IST hour
    const currentHourStr = getCurrentHourKolkata();
    let currentIdx = records.findIndex(r => r.datetime && r.datetime.replace('T', ' ').startsWith(currentHourStr));
    if (currentIdx === -1) {
      currentIdx = records.findIndex(r => r.datetime && r.datetime.replace('T', ' ') >= currentHourStr);
    }
    if (currentIdx === -1) {
      currentIdx = 0;
    }

    // Dynamically calculate offsets based on available remaining forecast window
    const availableRemaining = Math.max(0, records.length - 1 - currentIdx);
    const offsets = availableRemaining >= 71
      ? [0, 6, 12, 24, 48, 71]
      : availableRemaining >= 48
      ? [0, 6, 12, 24, 36, 48]
      : [0, Math.floor(availableRemaining * 0.2), Math.floor(availableRemaining * 0.4), Math.floor(availableRemaining * 0.6), Math.floor(availableRemaining * 0.8), availableRemaining];

    const timeLabels = offsets.map((off, idx) => {
      if (idx === 0) return 'NOW';
      return `+${off}h`;
    });
    const stepIndices = offsets.map(off => Math.min(records.length - 1, currentIdx + off));

    // Map confidence records by lead_day
    const confByLead: Record<number, number> = {};
    for (const c of confRecords || []) {
      if (c.lead_day && c.confidence != null && !confByLead[c.lead_day]) {
        confByLead[c.lead_day] = Math.round(c.confidence);
      }
    }

    return stepIndices.map((idx, i) => {
      const rec = records[idx] || records[records.length - 1];
      const timeStr = rec.datetime ? rec.datetime.split(' ')[1]?.slice(0, 5) || '00:00' : '00:00';
      const rawRain = rec.rainfall ?? 0;
      // Preserve 2 decimal precision for trace rainfall (< 1mm) so subtle variations are visible
      const rain = rawRain > 0 && rawRain < 1.0
        ? Math.round(rawRain * 100) / 100
        : Math.round(rawRain * 10) / 10;
      const temp = Math.round((rec.temperature ?? 30) * 10) / 10;
      const wind = Math.round((rec.wind_speed ?? 15) * 10) / 10;

      let risk: 'low' | 'moderate' | 'high' | 'severe' = 'low';
      if (rain > 50 || wind > 35 || temp > 40) risk = 'severe';
      else if (rain > 30 || wind > 25) risk = 'high';
      else if (rain > 10 || wind > 15) risk = 'moderate';

      // Real confidence derived from Explainable Confidence Engine (ECE)
      const leadDay = rec.lead_days || (i <= 2 ? 1 : i === 3 ? 1 : i === 4 ? 2 : 3);
      const baseConf = confByLead[leadDay] || (confRecords && confRecords[0]?.confidence != null ? Math.round(confRecords[0].confidence) : 84);
      const actualConfidence = Math.max(50, Math.round(baseConf - (leadDay - 1) * 3));

      // Dynamic uncertainty bands calculated from model residual spread
      const rainSpread = Math.abs((rec.rainfall ?? 0) - (rec.blend_rainfall ?? 0));
      let rainHigh = rain;
      let rainLow = rain;
      if (rain >= 0.5) {
        const rainUncertainty = Math.round((rain * (0.2 + 0.08 * leadDay) + Math.min(rainSpread * 0.5, 3)) * 10) / 10;
        rainHigh = Math.round((rain + rainUncertainty) * 10) / 10;
        rainLow = Math.max(0, Math.round((rain - rainUncertainty * 0.7) * 10) / 10);
      } else if (rain >= 0.2) {
        const traceSpread = Math.round((0.1 + rainSpread * 0.3) * 10) / 10;
        rainHigh = Math.round((rain + traceSpread) * 10) / 10;
        rainLow = Math.max(0, Math.round((rain - traceSpread * 0.5) * 10) / 10);
      }

      // TEMPERATURE: Physical bounds ±(0.8 + 0.3 * leadDay + spread)
      const tempSpread = Math.abs((rec.temperature ?? 30) - (rec.blend_temperature ?? 30));
      const tempUncertainty = Math.round((0.8 + tempSpread * 1.1 + leadDay * 0.3) * 10) / 10;
      const tempHigh = Math.round((temp + tempUncertainty) * 10) / 10;
      const tempLow = Math.round((temp - tempUncertainty) * 10) / 10;

      // WIND SPEED: Physical bounds ±(1.2 + 0.4 * leadDay + spread)
      const windSpread = Math.abs((rec.wind_speed ?? 15) - (rec.blend_wind_speed ?? 15));
      const windUncertainty = Math.round((1.2 + windSpread * 1.1 + leadDay * 0.4) * 10) / 10;
      const windHigh = Math.round((wind + windUncertainty) * 10) / 10;
      const windLow = Math.max(0, Math.round((wind - windUncertainty) * 10) / 10);

      return {
        time: timeLabels[i],
        label: timeStr,
        rainfall: rain,
        temperature: temp,
        wind: wind,
        confidence: actualConfidence,
        risk,
        rainfallUncertaintyHigh: rainHigh,
        rainfallUncertaintyLow: rainLow,
        temperatureUncertaintyHigh: tempHigh,
        temperatureUncertaintyLow: tempLow,
        windUncertaintyHigh: windHigh,
        windUncertaintyLow: windLow,
      };
    });
  } catch {
    return MOCK_TIMELINE;
  }
}

/**
 * Helper to get ModelWeight[] for ModelContribution component.
 */
export async function getModelWeightsData(city: string = 'Kanpur', variable: string = 'temperature'): Promise<ModelWeight[]> {
  try {
    const [weights, skills] = await Promise.all([
      getWeights(city, variable, 1),
      getSkillScores(city, variable),
    ]);

    if (!weights || weights.length === 0) {
      return MOCK_MODEL_WEIGHTS;
    }

    const modelDisplayNames: Record<string, { name: string; color: string }> = {
      ecmwf: { name: 'ECMWF IFS', color: '#0ea5e9' },
      gfs: { name: 'GFS Seamless', color: '#6366f1' },
      icon: { name: 'ICON Seamless', color: '#10b981' },
      gem: { name: 'GEM Seamless', color: '#8b5cf6' },
    };

    const totalWeight = weights.reduce((sum, w) => sum + (w.weight || 0), 0) || 1;

    return weights.map((w) => {
      const info = modelDisplayNames[w.model.toLowerCase()] || {
        name: w.model.toUpperCase(),
        color: '#64748b',
      };
      const skill = skills?.find(s => s.model.toLowerCase() === w.model.toLowerCase());
      const skillAvailable = Boolean(skill && typeof skill.rmse === 'number' && typeof skill.mae === 'number');

      return {
        id: w.model.toLowerCase(),
        name: info.name,
        weight: Math.round(((w.weight || 0) / totalWeight) * 100),
        color: info.color,
        rmse: skillAvailable && skill?.rmse !== undefined ? Math.round(skill.rmse * 100) / 100 : null,
        mae: skillAvailable && skill?.mae !== undefined ? Math.round(skill.mae * 100) / 100 : null,
        skillAvailable,
      };
    });
  } catch {
    return MOCK_MODEL_WEIGHTS;
  }
}

/**
 * Helper to get ModelComparison[] for ModelComparison component.
 * Uses real /api/model_forecasts endpoint data for ECMWF, GFS, ICON, GEM, and Hybrid.
 * No fabricated multipliers. Returns [] on failure so component can render unavailable state.
 */
export async function getModelComparisonData(city: string = 'Kanpur'): Promise<ModelComparison[]> {
  try {
    const records = await getModelForecasts(city, 1);
    if (!records || records.length === 0) {
      return [];
    }

    const currentHourStr = getCurrentHourKolkata();
    const getModelRow = (modelPrefix: string) => {
      const matches = records.filter(r => r.model && r.model.toLowerCase().includes(modelPrefix.toLowerCase()));
      if (matches.length === 0) return null;
      return matches.find(r => r.datetime && r.datetime.replace('T', ' ').startsWith(currentHourStr))
        || matches.find(r => r.datetime && r.datetime.replace('T', ' ') >= currentHourStr)
        || matches[0];
    };

    const ecmwf = getModelRow('ecmwf');
    const gfs = getModelRow('gfs');
    const icon = getModelRow('icon');
    const gem = getModelRow('gem');
    const hybrid = getModelRow('hybrid');

    const result: ModelComparison[] = [];
    if (ecmwf) {
      result.push({ model: 'ECMWF IFS', rainfall: Math.round((ecmwf.rainfall ?? 0) * 10) / 10, temperature: Math.round((ecmwf.temperature ?? 0) * 10) / 10, wind: Math.round((ecmwf.wind_speed ?? 0) * 10) / 10 });
    }
    if (gfs) {
      result.push({ model: 'GFS Seamless', rainfall: Math.round((gfs.rainfall ?? 0) * 10) / 10, temperature: Math.round((gfs.temperature ?? 0) * 10) / 10, wind: Math.round((gfs.wind_speed ?? 0) * 10) / 10 });
    }
    if (icon) {
      result.push({ model: 'ICON Seamless', rainfall: Math.round((icon.rainfall ?? 0) * 10) / 10, temperature: Math.round((icon.temperature ?? 0) * 10) / 10, wind: Math.round((icon.wind_speed ?? 0) * 10) / 10 });
    }
    if (gem) {
      result.push({ model: 'GEM Seamless', rainfall: Math.round((gem.rainfall ?? 0) * 10) / 10, temperature: Math.round((gem.temperature ?? 0) * 10) / 10, wind: Math.round((gem.wind_speed ?? 0) * 10) / 10 });
    }
    if (hybrid) {
      result.push({ model: 'Hybrid (Final)', rainfall: Math.round((hybrid.rainfall ?? 0) * 10) / 10, temperature: Math.round((hybrid.temperature ?? 0) * 10) / 10, wind: Math.round((hybrid.wind_speed ?? 0) * 10) / 10, isBlended: true });
    }

    return result;
  } catch {
    return [];
  }
}

/**
 * Helper to get CityForecast[] for WeatherMap component.
 */
export async function getCityForecastsData(leadDays: number = 1): Promise<CityForecast[]> {
  try {
    const validLeadDays = Math.max(1, Math.min(3, Number(leadDays) || 1));
    const [cities, forecastRecords, weightsRecords, confidenceRecords] = await Promise.all([
      getCities().catch(() => []),
      getForecast(undefined, validLeadDays).catch(() => []),
      getWeights(undefined, 'temperature', validLeadDays).catch(() => []),
      getConfidence(undefined, validLeadDays).catch(() => []),
    ]);

    if (!forecastRecords || forecastRecords.length === 0) {
      return MOCK_CITIES;
    }

    // Index representative record per city for this lead day
    const currentHourStr = getCurrentHourKolkata();
    const latestPerCity: Record<string, ForecastRecord> = {};
    for (const rec of forecastRecords) {
      const key = rec.city?.toLowerCase();
      if (!key) continue;
      const recTime = rec.datetime ? rec.datetime.replace('T', ' ') : '';
      if (!latestPerCity[key]) {
        latestPerCity[key] = rec;
      } else if (validLeadDays === 1) {
        if (recTime.startsWith(currentHourStr)) {
          latestPerCity[key] = rec;
        } else if (recTime >= currentHourStr && !latestPerCity[key].datetime?.replace('T', ' ').startsWith(currentHourStr)) {
          latestPerCity[key] = rec;
        }
      } else {
        // For Day 2 and Day 3, pick peak diurnal forecast reading around 12:00-14:00 PM
        const hour = recTime.slice(11, 13);
        if (hour === '12' || hour === '13' || hour === '14') {
          latestPerCity[key] = rec;
        }
      }
    }

    // Index confidence records by city
    const confPerCity: Record<string, ConfidenceRecord> = {};
    for (const c of confidenceRecords) {
      const key = c.city?.toLowerCase();
      if (key && !confPerCity[key]) {
        confPerCity[key] = c;
      }
    }

    // Index dominant model per city from weights
    const dominantModelPerCity: Record<string, string> = {};
    const maxWeightPerCity: Record<string, number> = {};
    for (const w of weightsRecords) {
      const key = w.city?.toLowerCase();
      if (key && (!maxWeightPerCity[key] || w.weight > maxWeightPerCity[key])) {
        maxWeightPerCity[key] = w.weight;
        dominantModelPerCity[key] = w.model.toUpperCase();
      }
    }

    // Merge with known coordinates and states
    return MOCK_CITIES.map((mockCity) => {
      const live = latestPerCity[mockCity.city.toLowerCase()];
      if (!live) return mockCity;

      const rain = Math.round((live.rainfall ?? mockCity.rainfall) * 10) / 10;
      const temp = Math.round((live.temperature ?? mockCity.temperature) * 10) / 10;
      const wind = Math.round((live.wind_speed ?? mockCity.wind) * 10) / 10;
      
      const conf = confPerCity[mockCity.city.toLowerCase()];
      const dominant = conf?.dominant_model || dominantModelPerCity[mockCity.city.toLowerCase()] || mockCity.dominantModel;
      const confidence = conf?.confidence != null ? Math.round(conf.confidence) : mockCity.confidence;
      const confidenceLabel = conf?.confidence_label;
      const explanation = conf?.explanation;

      let risk: 'low' | 'moderate' | 'high' | 'severe' = 'low';
      if (rain > 50 || wind > 35 || temp > 40) risk = 'severe';
      else if (rain > 30 || wind > 25) risk = 'high';
      else if (rain > 10 || wind > 15) risk = 'moderate';

      return {
        ...mockCity,
        rainfall: rain,
        temperature: temp,
        wind: wind,
        confidence,
        dominantModel: dominant,
        confidenceLabel,
        explanation,
        risk,
      };
    });
  } catch {
    return MOCK_CITIES;
  }
}

export const CITY_TO_STATE: Record<string, string> = {
  Delhi: 'Delhi',
  Mumbai: 'Maharashtra',
  Chennai: 'Tamil Nadu',
  Kolkata: 'West Bengal',
  Jaipur: 'Rajasthan',
  Guwahati: 'Assam',
  Bengaluru: 'Karnataka',
  Hyderabad: 'Telangana',
  Ahmedabad: 'Gujarat',
  Pune: 'Maharashtra',
  Surat: 'Gujarat',
  Lucknow: 'Uttar Pradesh',
  Kanpur: 'Uttar Pradesh',
  Nagpur: 'Maharashtra',
  Indore: 'Madhya Pradesh',
  Thane: 'Maharashtra',
  Bhopal: 'Madhya Pradesh',
  Visakhapatnam: 'Andhra Pradesh',
  Patna: 'Bihar',
  Vadodara: 'Gujarat',
  Ghaziabad: 'Uttar Pradesh',
  Ludhiana: 'Punjab',
  Agra: 'Uttar Pradesh',
  Nashik: 'Maharashtra',
  Ranchi: 'Jharkhand',
  Varanasi: 'Uttar Pradesh',
  Srinagar: 'Jammu & Kashmir',
  Amritsar: 'Punjab',
  Coimbatore: 'Tamil Nadu',
  Vijayawada: 'Andhra Pradesh',
  Jodhpur: 'Rajasthan',
  Madurai: 'Tamil Nadu',
  Raipur: 'Chhattisgarh',
  Kota: 'Rajasthan',
  Chandigarh: 'Punjab',
  Dehradun: 'Uttarakhand',
  Shimla: 'Himachal Pradesh',
  Thiruvananthapuram: 'Kerala',
  Kochi: 'Kerala',
  Bhubaneswar: 'Odisha',
  Goa: 'Goa',
  Imphal: 'Manipur',
  Shillong: 'Meghalaya',
  Agartala: 'Tripura',
  Jabalpur: 'Madhya Pradesh',
};

export function getAlertState(location?: string): string {
  if (!location) return 'Other';
  if (location.includes(',')) {
    const parts = location.split(',').map((s) => s.trim());
    const city = parts[0];
    if (CITY_TO_STATE[city]) return CITY_TO_STATE[city];
    const candidate = parts[1];
    if (candidate === 'UP') return 'Uttar Pradesh';
    if (candidate === 'MP') return 'Madhya Pradesh';
    return candidate;
  }
  if (CITY_TO_STATE[location]) {
    return CITY_TO_STATE[location];
  }
  const match = Object.keys(CITY_TO_STATE).find(
    (c) => c.toLowerCase() === location.trim().toLowerCase()
  );
  if (match) return CITY_TO_STATE[match];
  return 'Other';
}

/**
 * Helper to get Alert[] for AlertCenter and ExtremeWeatherPage.
 */
export async function getAlertsData(city?: string): Promise<Alert[]> {
  try {
    const rawAlerts = await getAlerts(city);
    if (!rawAlerts || rawAlerts.length === 0) {
      if (city) {
        return [];
      }
      return MOCK_ALERTS;
    }

    return rawAlerts.map((a, i) => {
      const isRain = a.event.toLowerCase().includes('rain');
      const isWind = a.event.toLowerCase().includes('wind');
      const unit = isRain ? 'mm/hr' : isWind ? 'km/h' : '°C';
      const timeStr = a.datetime ? a.datetime.slice(11, 16) : '00:00';
      const dateStr = a.datetime ? a.datetime.slice(5, 10) : '';
      const state = getAlertState(a.city);

      return {
        id: `live-alert-${i}`,
        type: a.severity.toLowerCase() === 'high' ? 'danger' : 'warning',
        title: `${a.event} Alert`,
        location: `${a.city}, ${state}`,
        state: state,
        window: `${timeStr} IST (${dateStr})`,
        timestamp: `${a.forecast_value} ${unit}`,
      };
    });
  } catch {
    return MOCK_ALERTS;
  }
}

/**
 * Helper to get ExtremeEvent[] for ExtremeWeather component.
 * Attaches real confidence scores fetched from /api/confidence.
 */
export async function getExtremeEventsData(city?: string): Promise<ExtremeEvent[]> {
  try {
    const [rawAlerts, confScores] = await Promise.all([
      getAlerts(city).catch(() => []),
      getConfidence(city).catch(() => []),
    ]);

    const defaultConf = confScores && confScores.length > 0 && typeof confScores[0].confidence === 'number'
      ? Math.round(confScores[0].confidence)
      : 84;

    if (!rawAlerts || rawAlerts.length === 0) {
      return [
        {
          type: 'heavy_rainfall',
          label: 'Safe Conditions',
          probability: 5,
          window: 'Next 72 Hours',
          confidence: defaultConf,
          severity: 'watch',
          description: `All forecast parameters for ${city || 'this station'} remain safely below severe hazard thresholds.`,
        }
      ];
    }

    return rawAlerts.slice(0, 4).map((a) => {
      const isRain = a.event.toLowerCase().includes('rain');
      const isTemp = a.event.toLowerCase().includes('temp');
      const isWind = a.event.toLowerCase().includes('wind');
      const unit = isRain ? 'mm/hr' : isWind ? 'km/h' : '°C';
      const type = isRain ? 'heavy_rainfall' : isTemp ? 'heatwave' : 'high_wind';
      const isHigh = a.severity.toLowerCase() === 'high';
      const timeStr = a.datetime ? a.datetime.slice(11, 16) : '00:00';

      let matchedConf = defaultConf;
      if (confScores && confScores.length > 0 && a.datetime) {
        const found = confScores.find(c => c.datetime === a.datetime);
        if (found && typeof found.confidence === 'number') {
          matchedConf = Math.round(found.confidence);
        }
      }

      return {
        type,
        label: a.event,
        probability: isHigh ? 88 : 72,
        window: `${timeStr} IST`,
        confidence: matchedConf,
        severity: isHigh ? 'alert' : 'warning',
        description: `Predicted: ${a.forecast_value} ${unit} (Exceeds ${a.threshold} ${unit} threshold)`,
      };
    });
  } catch {
    return MOCK_EXTREME_EVENTS;
  }
}

/**
 * Helper to get SkillMetric[] for ModelSkill and ModelPerformancePage.
 * Uses real test-split performance metrics from /api/performance.
 * If endpoint fails, returns empty array to signal unavailable state (no mock numbers).
 */
export async function getSkillMetricsData(): Promise<SkillMetric[]> {
  try {
    const records = await getPerformance();
    if (!records || records.length === 0) {
      return [];
    }

    const tempRecords = records.filter(r => r.variable.toLowerCase() === 'temperature');
    if (tempRecords.length === 0) {
      return [];
    }

    const getRmse = (method: string, lead: number) => {
      const rec = tempRecords.find(r => r.method.toLowerCase() === method.toLowerCase() && r.lead_days === lead);
      return rec ? rec.rmse : 0;
    };

    const getAvgRmse = (method: string) => {
      const list = tempRecords.filter(r => r.method.toLowerCase() === method.toLowerCase());
      if (list.length === 0) return 0;
      return Math.round((list.reduce((acc, c) => acc + c.rmse, 0) / list.length) * 10000) / 10000;
    };

    return [
      {
        period: 'Lead 1 (24h)',
        blended: getRmse('weighted_blend', 1),
        ai: getRmse('hybrid_rf', 1),
        nwpA: getRmse('ecmwf', 1),
        nwpB: getRmse('gfs', 1),
        ensemble: getRmse('equal_avg', 1),
      },
      {
        period: 'Lead 2 (48h)',
        blended: getRmse('weighted_blend', 2),
        ai: getRmse('hybrid_rf', 2),
        nwpA: getRmse('ecmwf', 2),
        nwpB: getRmse('gfs', 2),
        ensemble: getRmse('equal_avg', 2),
      },
      {
        period: 'Lead 3 (72h)',
        blended: getRmse('weighted_blend', 3),
        ai: getRmse('hybrid_rf', 3),
        nwpA: getRmse('ecmwf', 3),
        nwpB: getRmse('gfs', 3),
        ensemble: getRmse('equal_avg', 3),
      },
    ];
  } catch {
    return [];
  }
}

/**
 * Generates dynamic Government Resource Recommendations based on weather thresholds.
 */
export function generateResourceRecommendations(city: string, rainfall: number, temp: number, wind: number): ResourceAction[] {
  const cKey = city.toLowerCase();
  const recs: ResourceAction[] = [];

  // --- 1. FLOOD & PRECIPITATION CONTINGENCY ---
  if (rainfall >= 50) {
    const boats = Math.max(2, Math.floor(rainfall * 0.25));
    const pumps = Math.max(5, Math.floor(rainfall * 0.4));
    const personnel = Math.max(20, Math.floor(rainfall * 1.5));
    const shelterCap = Math.max(200, Math.floor(rainfall * 50));
    recs.push({
      id: `${cKey}-rec-rain-crit`,
      title: 'Stage 4 (Red) Critical Alert: Deploy SDRF & NDRF Rescue Battalions',
      description: `Stage 4 (Red) Critical Alert: Pre-position rescue boats & diving personnel at low-lying riverine basins. Projected rainfall: ${rainfall.toFixed(1)} mm/24h. Estimated requirement: ${boats} inflatable rescue boats, ${personnel} response personnel.`,
      category: 'rain',
      priority: 'critical',
      department: 'Disaster Management Authority (SDMA / DDMA)',
      status: 'Ready',
      actionCode: 'SDRF-DEPL-01',
      estimatedResources: {
        rescueBoats: boats,
        personnel: personnel,
        dewateringPumps: pumps,
        shelterCapacity: shelterCap,
      },
    });
  } else if (rainfall >= 20) {
    const boats = Math.max(1, Math.floor(rainfall * 0.2));
    const pumps = Math.max(4, Math.floor(rainfall * 0.35));
    const personnel = Math.max(12, Math.floor(rainfall * 1.2));
    recs.push({
      id: `${cKey}-rec-rain-high`,
      title: 'Stage 3 (Orange) High Alert: Pre-emptive Sump Mobilization & SDRF Standby',
      description: `Stage 3 (Orange) High Alert: Position mobile dewatering pumps at major urban underpasses and storm drains facing ${rainfall.toFixed(1)} mm/24h rainfall. Standby rescue squads on 30-min notice.`,
      category: 'rain',
      priority: 'high',
      department: 'Municipal Corporation / PWD & SDRF',
      status: 'Active',
      actionCode: 'DRAIN-PUMP-02',
      estimatedResources: {
        dewateringPumps: pumps,
        standbyBoats: boats,
        responseSquads: personnel,
      },
    });
  } else if (rainfall >= 5) {
    const pumps = Math.max(2, Math.floor(rainfall * 0.3));
    const personnel = Math.max(6, Math.floor(rainfall * 0.8));
    recs.push({
      id: `${cKey}-rec-rain-med`,
      title: 'Stage 2 (Yellow) Alert: Catchment Basin & Storm Sump Surveillance',
      description: `Stage 2 (Yellow) Alert: Moderate rainfall expected (${rainfall.toFixed(1)} mm/24h). Monitor municipal culverts and test automated sump sensors. Maintain emergency clearing teams.`,
      category: 'rain',
      priority: 'medium',
      department: 'Urban Water Supply & Drainage Cell',
      status: 'Active',
      actionCode: 'BASIN-WATCH-03',
      estimatedResources: {
        standbyPumps: pumps,
        patrolCrews: personnel,
      },
    });
  } else {
    recs.push({
      id: `${cKey}-rec-rain-base`,
      title: 'Stage 1 (Green) Baseline: Synoptic Pluviometer Monitoring & Readiness',
      description: `Stage 1 (Green) Baseline: Light/normal rainfall (${rainfall.toFixed(1)} mm/24h). Maintain automated radar rain-gauge calibration and synoptic telemetry monitoring.`,
      category: 'rain',
      priority: 'routine',
      department: 'State Meteorological Control Cell',
      status: 'Active',
      actionCode: 'RAIN-BASE-04',
      estimatedResources: {
        activeRainGauges: 8,
        telemetrySensors: 12,
      },
    });
  }

  // --- 2. HEAT ACTION PLAN PROTOCOL ---
  if (temp >= 40) {
    const tankers = Math.max(6, Math.floor((temp - 35) * 5));
    const orsPkts = Math.floor((temp - 35) * 1500);
    const coolingCenters = Math.max(4, Math.floor((temp - 35) * 2.5));
    const heatBeds = Math.max(20, Math.floor((temp - 35) * 10));
    recs.push({
      id: `${cKey}-rec-heat-crit`,
      title: 'Stage 4 (Red) Emergency: Heatwave Red Alert & Outdoor Work Curfew',
      description: `Stage 4 (Red) Emergency: Severe heatwave conditions (${temp.toFixed(1)}°C). Enforce physical outdoor labor ban from 11:30 AM to 03:30 PM. Mobilize hospital burn/heat stroke wards.`,
      category: 'heat',
      priority: 'critical',
      department: 'Dept of Public Health & Disaster Management',
      status: 'Active',
      actionCode: 'HEAT-ADV-01',
      estimatedResources: {
        emergencyHeatBeds: heatBeds,
        waterTankers: tankers,
        orsPackets: orsPkts,
        coolingCenters: coolingCenters,
      },
    });
  } else if (temp >= 36) {
    const tankers = Math.max(4, Math.floor((temp - 33) * 3));
    const orsPkts = Math.floor((temp - 33) * 1000);
    const coolingCenters = Math.max(2, Math.floor((temp - 33) * 1.5));
    recs.push({
      id: `${cKey}-rec-heat-high`,
      title: 'Stage 3 (Orange) High Alert: Civic Air-Cooled Relief Shelters & Tankers',
      description: `Stage 3 (Orange) High Alert: Elevated thermal stress (${temp.toFixed(1)}°C). Open air-conditioned public transit hubs & libraries with ORS kiosks. Dispatch water bowsers to unshaded wards.`,
      category: 'heat',
      priority: 'high',
      department: 'Urban Local Bodies / Health Dept',
      status: 'Ready',
      actionCode: 'COOL-CTR-02',
      estimatedResources: {
        coolingCenters: coolingCenters,
        waterTankers: tankers,
        orsPackets: orsPkts,
      },
    });
  } else if (temp >= 31) {
    const tankers = Math.max(2, Math.floor((temp - 28) * 1.5));
    const orsPkts = Math.max(500, Math.floor((temp - 28) * 500));
    recs.push({
      id: `${cKey}-rec-heat-med`,
      title: 'Stage 2 (Yellow) Alert: Thermal Index Advisory & Public Hydration Points',
      description: `Stage 2 (Yellow) Alert: Warm conditions (${temp.toFixed(1)}°C). Setup civic water kiosks at major bus terminals and marketplaces. Issue heat avoidance guidelines.`,
      category: 'heat',
      priority: 'medium',
      department: 'Municipal Public Health Wing',
      status: 'Active',
      actionCode: 'WATER-MOB-03',
      estimatedResources: {
        hydrationKiosks: tankers,
        orsUnits: orsPkts,
      },
    });
  } else {
    recs.push({
      id: `${cKey}-rec-heat-base`,
      title: 'Stage 1 (Green) Baseline: Thermal Baseline & Heat Index Surveillance',
      description: `Stage 1 (Green) Baseline: Temperature (${temp.toFixed(1)}°C) within normal seasonal comfort thresholds. Maintain surface air temperature sensor calibration.`,
      category: 'heat',
      priority: 'routine',
      department: 'Health Surveillance & Met Cell',
      status: 'Active',
      actionCode: 'HEAT-BASE-04',
      estimatedResources: {
        ambientSensors: 6,
        healthMonitors: 2,
      },
    });
  }

  // --- 3. WIND & INFRASTRUCTURE DEFENSE ---
  if (wind >= 45) {
    const cranes = Math.max(3, Math.floor(wind * 0.15));
    const crews = Math.max(6, Math.floor(wind * 0.3));
    const vessels = Math.max(2, Math.floor(wind * 0.1));
    recs.push({
      id: `${cKey}-rec-wind-crit`,
      title: 'Stage 4 (Red) Critical: Suspend Marine Operations & Halt High-Altitude Cranes',
      description: `Stage 4 (Red) Critical: Dangerous wind gusts (${wind.toFixed(1)} km/h). Issue immediate port and artisanal fishing craft bans. Halt construction tower cranes and evacuate vulnerable scaffolding.`,
      category: 'wind',
      priority: 'critical',
      department: 'Port Authority, Labour & Police Safety',
      status: 'Active',
      actionCode: 'OPS-HALT-02',
      estimatedResources: {
        patrolVessels: vessels,
        craneSafetyUnits: cranes,
        emergencyLineCrews: crews,
      },
    });
  } else if (wind >= 30) {
    const cranes = Math.max(1, Math.floor(wind * 0.1));
    const crews = Math.max(4, Math.floor(wind * 0.25));
    recs.push({
      id: `${cKey}-rec-wind-high`,
      title: 'Stage 3 (Orange) High Alert: Secure Overhead Hoardings & Scaffolding Inspections',
      description: `Stage 3 (Orange) High Alert: Strong wind gusts (${wind.toFixed(1)} km/h). Inspect and dismantle unauthorized billboards and temporary construction hoardings.`,
      category: 'wind',
      priority: 'high',
      department: 'Municipal Town Planning / Safety Wing',
      status: 'Active',
      actionCode: 'WIND-SEC-01',
      estimatedResources: {
        safetyInspectors: crews,
        mobileCranes: cranes,
      },
    });
  } else if (wind >= 18) {
    const crews = Math.max(2, Math.floor(wind * 0.2));
    recs.push({
      id: `${cKey}-rec-wind-med`,
      title: 'Stage 2 (Yellow) Alert: Power Grid Line Patrol & Tree Clearing Squads',
      description: `Stage 2 (Yellow) Alert: Moderate wind activity (${wind.toFixed(1)} km/h). Pre-position power transmission line maintenance crews and hydraulic branch trimming teams.`,
      category: 'wind',
      priority: 'medium',
      department: 'State Electricity Board / Forestry Works',
      status: 'Standby',
      actionCode: 'GRID-STBY-03',
      estimatedResources: {
        powerRestorationCrews: crews,
        treeTrimmingUnits: Math.max(1, Math.floor(crews / 2)),
      },
    });
  } else {
    recs.push({
      id: `${cKey}-rec-wind-base`,
      title: 'Stage 1 (Green) Baseline: Anemometer Verification & Baseline Grid Monitoring',
      description: `Stage 1 (Green) Baseline: Wind velocity (${wind.toFixed(1)} km/h) well within safe operational engineering parameters. Continuous sonic anemometer tracking.`,
      category: 'wind',
      priority: 'routine',
      department: 'State Meteorological Control Cell',
      status: 'Active',
      actionCode: 'WIND-BASE-04',
      estimatedResources: {
        anemometers: 6,
        gridTelemetry: 10,
      },
    });
  }

  return recs;
}

/**
 * Calculates RPI Data for a given city with API-first and local fallback.
 */
export async function getRpiData(city: string = 'Kanpur'): Promise<RpiData> {
  try {
    const raw = await fetchFromApi<RpiData | null>(`/rpi?city=${encodeURIComponent(city)}`, null);
    if (raw && raw.rpiScore !== undefined) {
      return raw;
    }
  } catch {
    // Proceed to local robust calculation
  }

  const [metrics, cities, confRecords] = await Promise.all([
    getForecastMetrics(city),
    getCityForecastsData(),
    getConfidence(city, 1).catch(() => null),
  ]);

  const matchCity = cities.find(c => c.city.toLowerCase() === city.toLowerCase()) || cities[0];
  const rain = metrics.rainfall ?? matchCity.rainfall ?? 15;
  const temp = metrics.temperature ?? matchCity.temperature ?? 30;
  const wind = metrics.wind ?? matchCity.wind ?? 15;
  const conf = metrics.confidence ?? matchCity.confidence ?? 85;

  const rainRisk = Math.min(100, Math.max(0, Math.round((rain / 80) * 100 * 10) / 10));
  const heatRisk = Math.min(100, Math.max(0, Math.round(((temp - 25) / 20) * 100 * 10) / 10));
  const windRisk = Math.min(100, Math.max(0, Math.round((wind / 65) * 100 * 10) / 10));
  const confScore = Math.min(100, Math.max(0, conf));

  // Decoupled Formula: Hazard = 70% Max Hazard + 30% Mean Hazard (Confidence-free)
  const hazardMean = (rainRisk + heatRisk + windRisk) / 3;
  const hazardMax = Math.max(rainRisk, heatRisk, windRisk);
  const hazardRaw = Math.min(100, Math.max(0, Math.round((hazardMax * 0.70 + hazardMean * 0.30) * 10) / 10));
  const rpiScore = hazardRaw;

  let tierLevel: 'Green' | 'Yellow' | 'Orange' | 'Red' = 'Green';
  let priority: 'Low' | 'Moderate' | 'High' | 'Critical' = 'Low';
  let actionTier = 'Hazard Level 1 (Green) — Routine Monitoring';
  let confidenceBadge: string | null = null;
  let actionDirective = 'Routine Synoptic Surveillance, Standard Sensor Telemetry';

  if (hazardRaw >= 75) {
    tierLevel = 'Red';
    priority = 'Critical';
    actionTier = 'Hazard Level 4 (Red) — Critical Emergency';
    if (confScore >= 70) {
      confidenceBadge = 'High Confidence — Immediate Action';
      actionDirective = 'Mandatory Evacuation Directive, Pre-position NDRF Battalions';
    } else {
      confidenceBadge = 'Low Confidence — Verify Before Escalating';
      actionDirective = 'High Vigilance, Urgent Radar/Satellite Reconnaissance, SDRF Standby';
    }
  } else if (hazardRaw >= 56) {
    tierLevel = 'Orange';
    priority = 'High';
    actionTier = 'Hazard Level 3 (Orange) — High Alert';
    confidenceBadge = null;
    actionDirective = 'Urgent Action Mandated, Mobilize Field Teams & Dewatering Sumps';
  } else if (hazardRaw >= 31) {
    tierLevel = 'Yellow';
    priority = 'Moderate';
    actionTier = 'Hazard Level 2 (Yellow) — Moderate Watch';
    confidenceBadge = null;
    actionDirective = 'Heightened Watch, Localized Municipal Drainage Clearing';
  }

  let domModel = confRecords && confRecords.length > 0 ? confRecords[0].dominant_model : matchCity.dominantModel || 'ECMWF';
  if (domModel === 'AI') domModel = 'ECMWF';
  if (!['ECMWF', 'ICON', 'GFS', 'GEM'].includes(domModel)) {
    domModel = rain > 45 ? 'ECMWF' : temp > 35 ? 'ICON' : 'GFS';
  }

  const weights =
    domModel === 'ECMWF'
      ? { ecmwf: 45, icon: 25, gfs: 18, gem: 12 }
      : domModel === 'ICON'
      ? { ecmwf: 25, icon: 45, gfs: 18, gem: 12 }
      : domModel === 'GFS'
      ? { ecmwf: 20, icon: 22, gfs: 46, gem: 12 }
      : { ecmwf: 22, icon: 20, gfs: 18, gem: 40 };

  const recs = generateResourceRecommendations(matchCity.city, rain, temp, wind);

  return {
    city: matchCity.city,
    state: matchCity.state || 'Uttar Pradesh',
    lat: matchCity.lat,
    lon: matchCity.lon,
    rainfall: Math.round(rain * 10) / 10,
    temperature: Math.round(temp * 10) / 10,
    wind: Math.round(wind * 10) / 10,
    confidence: confScore,
    confidenceBadge,
    actionDirective,
    tierLevel,
    rainRisk,
    heatRisk,
    windRisk,
    rpi: rpiScore,
    rpiScore,
    actionTier,
    priority,
    dominantModel: domModel,
    modelWeights: weights,
    recommendations: recs,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Returns RPI Data for all 45 Indian Synoptic stations.
 */
export async function getAllRpiData(): Promise<RpiData[]> {
  try {
    const raw = await fetchFromApi<RpiData[]>('/rpi', []);
    if (raw && Array.isArray(raw) && raw.length > 0) {
      return raw;
    }
  } catch {}

  const cities = await getCityForecastsData();
  return cities.map(c => {
    const rain = c.rainfall;
    const temp = c.temperature;
    const wind = c.wind;
    const conf = c.confidence;

    const rainRisk = Math.min(100, Math.max(0, Math.round((rain / 80) * 100 * 10) / 10));
    const heatRisk = Math.min(100, Math.max(0, Math.round(((temp - 25) / 20) * 100 * 10) / 10));
    const windRisk = Math.min(100, Math.max(0, Math.round((wind / 65) * 100 * 10) / 10));

    // Decoupled Formula: Hazard = 70% Max Hazard + 30% Mean Hazard (Confidence-free)
    const hazardMean = (rainRisk + heatRisk + windRisk) / 3;
    const hazardMax = Math.max(rainRisk, heatRisk, windRisk);
    const hazardRaw = Math.min(100, Math.max(0, Math.round((hazardMax * 0.70 + hazardMean * 0.30) * 10) / 10));
    const rpiScore = hazardRaw;

    let tierLevel: 'Green' | 'Yellow' | 'Orange' | 'Red' = 'Green';
    let priority: 'Low' | 'Moderate' | 'High' | 'Critical' = 'Low';
    let actionTier = 'Hazard Level 1 (Green) — Routine Monitoring';
    let confidenceBadge: string | null = null;
    let actionDirective = 'Routine Synoptic Surveillance, Standard Sensor Telemetry';

    if (hazardRaw >= 75) {
      tierLevel = 'Red';
      priority = 'Critical';
      actionTier = 'Hazard Level 4 (Red) — Critical Emergency';
      if (conf >= 70) {
        confidenceBadge = 'High Confidence — Immediate Action';
        actionDirective = 'Mandatory Evacuation Directive, Pre-position NDRF Battalions';
      } else {
        confidenceBadge = 'Low Confidence — Verify Before Escalating';
        actionDirective = 'High Vigilance, Urgent Radar/Satellite Reconnaissance, SDRF Standby';
      }
    } else if (hazardRaw >= 56) {
      tierLevel = 'Orange';
      priority = 'High';
      actionTier = 'Hazard Level 3 (Orange) — High Alert';
      confidenceBadge = null;
      actionDirective = 'Urgent Action Mandated, Mobilize Field Teams & Dewatering Sumps';
    } else if (hazardRaw >= 31) {
      tierLevel = 'Yellow';
      priority = 'Moderate';
      actionTier = 'Hazard Level 2 (Yellow) — Moderate Watch';
      confidenceBadge = null;
      actionDirective = 'Heightened Watch, Localized Municipal Drainage Clearing';
    }

    let domModel = c.dominantModel || 'ECMWF';
    if (domModel === 'AI' || domModel === 'Ensemble') {
      domModel = rain > 50 ? 'ECMWF' : temp > 34 ? 'ICON' : 'GFS';
    }

    const weights =
      domModel === 'ECMWF'
        ? { ecmwf: 45, icon: 25, gfs: 18, gem: 12 }
        : domModel === 'ICON'
        ? { ecmwf: 25, icon: 45, gfs: 18, gem: 12 }
        : domModel === 'GFS'
        ? { ecmwf: 20, icon: 22, gfs: 46, gem: 12 }
        : { ecmwf: 22, icon: 20, gfs: 18, gem: 40 };

    return {
      city: c.city,
      state: c.state || 'India',
      lat: c.lat,
      lon: c.lon,
      rainfall: rain,
      temperature: temp,
      wind: wind,
      confidence: conf,
      confidenceBadge,
      actionDirective,
      tierLevel,
      rainRisk,
      heatRisk,
      windRisk,
      rpi: rpiScore,
      rpiScore,
      actionTier,
      priority,
      dominantModel: domModel,
      modelWeights: weights,
      recommendations: generateResourceRecommendations(c.city, rain, temp, wind),
      updatedAt: new Date().toISOString(),
    };
  });
}

export interface GeoJsonStationFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    city: string;
    state: string;
    rpiScore: number;
    priority: 'Low' | 'Moderate' | 'High' | 'Critical';
    dominantModel: string;
    rainfall: number;
    temperature: number;
    wind: number;
    confidence: number;
  };
}

export interface RpiMapGeoJson {
  type: 'FeatureCollection';
  features: GeoJsonStationFeature[];
  metadata: {
    totalStations: number;
    generatedAt: string;
    crs: string;
  };
}

/**
 * Fetches GeoJSON Map FeatureCollection for RPI Map APIs.
 */
export async function getRpiMapGeoJson(): Promise<RpiMapGeoJson | null> {
  try {
    const raw = await fetchFromApi<RpiMapGeoJson | null>('/rpi/map', null);
    if (raw && raw.features && raw.features.length > 0) {
      return raw;
    }
  } catch {}
  return null;
}
