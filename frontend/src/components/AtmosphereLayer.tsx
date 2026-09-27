'use client';

import React, { useMemo, useState } from 'react';
import styles from './atmosphere.module.css';

export interface AtmosphereLayerProps {
  condition?: string;
  rainfall?: number;
  temperature?: number;
  wind?: number;
  alert_type?: string;
}

export type AtmosphereTheme = 'simple' | 'sunny' | 'cloudy' | 'rain' | 'thunderstorm' | 'heatwave' | 'fog' | 'snow';

/**
 * Resolves the atmospheric theme according to live blended weather values.
 */
export function resolveAtmosphereTheme(
  condition?: string,
  rainfall: number = 0,
  temperature: number = 28,
  wind: number = 12,
  alert_type?: string
): AtmosphereTheme {
  const cond = (condition || '').toLowerCase().trim();
  const alert = (alert_type || '').toLowerCase().trim();

  // 1. Thunderstorm: alert_type = storm OR condition contains storm/thunder/cyclone
  if (
    alert === 'storm' ||
    alert.includes('storm') ||
    alert.includes('cyclone') ||
    cond.includes('storm') ||
    cond.includes('thunder')
  ) {
    return 'thunderstorm';
  }

  // 2. Heatwave: temperature >= 38°C
  if (temperature >= 38 || cond.includes('heatwave')) {
    return 'heatwave';
  }

  // 3. Snow: snow condition or sub-zero precipitation
  if (cond.includes('snow') || cond.includes('blizzard') || (temperature <= 0 && rainfall > 0)) {
    return 'snow';
  }

  // 4. Fog: fog or heavy mist
  if (cond.includes('fog') || cond.includes('mist') || cond.includes('haze')) {
    return 'fog';
  }

  // 5. Rain: rainfall > 10 mm or rain condition
  if (rainfall > 10 || cond.includes('rain') || cond.includes('shower') || cond.includes('drizzle')) {
    return 'rain';
  }

  // 6. Cloudy: cloudy or overcast or moderate rain/wind
  if (cond.includes('cloud') || cond.includes('overcast') || rainfall > 1 || wind > 20) {
    return 'cloudy';
  }

  // 7. Sunny: clear or sunny (default)
  return 'sunny';
}

const THEME_LABELS: Record<AtmosphereTheme, { label: string; icon: string; dotColor: string }> = {
  simple: { label: 'Simple UI', icon: '✨', dotColor: '#94a3b8' },
  sunny: { label: 'Sunny', icon: '☀️', dotColor: '#f59e0b' },
  rain: { label: 'Rain', icon: '🌧️', dotColor: '#60a5fa' },
  thunderstorm: { label: 'Thunderstorm', icon: '⚡', dotColor: '#a855f7' },
  cloudy: { label: 'Cloudy', icon: '☁️', dotColor: '#94a3b8' },
  heatwave: { label: 'Heatwave', icon: '🔥', dotColor: '#f97316' },
  fog: { label: 'Fog', icon: '🌫️', dotColor: '#cbd5e1' },
  snow: { label: 'Snow', icon: '❄️', dotColor: '#67e8f9' },
};

export function AtmosphereLayer({
  condition,
  rainfall = 0,
  temperature = 28,
  wind = 12,
  alert_type,
}: AtmosphereLayerProps) {
  const [manualTheme, setManualTheme] = useState<AtmosphereTheme | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const autoTheme = useMemo(
    () => resolveAtmosphereTheme(condition, rainfall, temperature, wind, alert_type),
    [condition, rainfall, temperature, wind, alert_type]
  );

  const activeTheme = manualTheme || autoTheme;
  const currentMeta = THEME_LABELS[activeTheme];

  return (
    <>
      {/* Hidden SVG Filters for Heat Shimmer Distortion */}
      <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
        <defs>
          <filter id="heat-shimmer-filter" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.04" numOctaves="2" result="noise">
              <animate attributeName="baseFrequency" dur="10s" values="0.012 0.04; 0.016 0.07; 0.012 0.04" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="14" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* ====================================================================
          LAYER 1: DEEP SKY ENVIRONMENTAL BACKDROP (z-index: 0, under cards)
          ==================================================================== */}
      <div className={styles.backdropContainer} aria-hidden="true">
        {/* 0. SIMPLE UI BACKDROP: Classic clean gradient, no animations or particles */}
        {activeTheme === 'simple' && (
          <div className="absolute inset-0">
            <div className={styles.simpleBackdrop} />
          </div>
        )}

        {/* 1. SUNNY BACKDROP: Warm golden yellow sky with sun rays behind */}
        {activeTheme === 'sunny' && (
          <div className="absolute inset-0">
            <div className={styles.sunnyBackdrop} />
            <div className={styles.sunDisc} />
            {/* Sun rays rotating BEHIND dashboard cards making bg warm yellow */}
            <div className={styles.sunRays}>
              <svg viewBox="0 0 800 800" width="100%" height="100%" fill="none">
                <defs>
                  <radialGradient id="sunRayGradLarge" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.75" />
                    <stop offset="35%" stopColor="#fbbf24" stopOpacity="0.45" />
                    <stop offset="70%" stopColor="#fef08a" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#fef3c7" stopOpacity="0" />
                  </radialGradient>
                </defs>
                {Array.from({ length: 14 }).map((_, i) => {
                  const x1 = Math.round((400 + 400 * Math.cos((i * 25.7 * Math.PI) / 180)) * 100) / 100;
                  const y1 = Math.round((400 + 400 * Math.sin((i * 25.7 * Math.PI) / 180)) * 100) / 100;
                  const x2 = Math.round((400 + 400 * Math.cos(((i * 25.7 + 10) * Math.PI) / 180)) * 100) / 100;
                  const y2 = Math.round((400 + 400 * Math.sin(((i * 25.7 + 10) * Math.PI) / 180)) * 100) / 100;
                  return (
                    <path
                      key={i}
                      d={`M 400 400 L ${x1} ${y1} L ${x2} ${y2} Z`}
                      fill="url(#sunRayGradLarge)"
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {/* 2. CLOUDY BACKDROP */}
        {activeTheme === 'cloudy' && (
          <div className="absolute inset-0">
            <div className={styles.cloudyBackdrop} />
            <div className={styles.cloudLayer1}>
              <svg viewBox="0 0 1200 320" width="100%" height="100%" fill="none">
                <path
                  d="M 100 220 Q 250 80 400 180 Q 550 60 700 190 Q 850 90 1000 220 L 1200 240 L 1200 320 L 0 320 Z"
                  fill="rgba(100, 116, 139, 0.45)"
                />
              </svg>
            </div>
            <div className={styles.cloudLayer2}>
              <svg viewBox="0 0 1400 340" width="100%" height="100%" fill="none">
                <path
                  d="M 50 240 Q 220 110 390 200 Q 560 90 730 210 Q 900 100 1150 220 L 1400 240 L 1400 340 L 0 340 Z"
                  fill="rgba(148, 163, 184, 0.4)"
                />
              </svg>
            </div>
            <div className={styles.cloudLayer3}>
              <svg viewBox="0 0 1300 320" width="100%" height="100%" fill="none">
                <path
                  d="M 80 200 Q 260 80 450 170 Q 640 60 850 180 Q 1060 90 1250 200 L 1300 320 L 0 320 Z"
                  fill="rgba(203, 213, 225, 0.35)"
                />
              </svg>
            </div>
          </div>
        )}

        {/* 3. RAIN BACKDROP */}
        {activeTheme === 'rain' && (
          <div className="absolute inset-0">
            <div className={styles.rainBackdrop} />
            <div className={styles.rainCloudCanopy}>
              <svg viewBox="0 0 1400 280" width="100%" height="100%" fill="none">
                <path
                  d="M 0 180 Q 200 70 450 160 Q 700 60 950 170 Q 1200 80 1400 190 L 1400 0 L 0 0 Z"
                  fill="rgba(30, 41, 59, 0.75)"
                />
              </svg>
            </div>
          </div>
        )}

        {/* 4. THUNDERSTORM BACKDROP */}
        {activeTheme === 'thunderstorm' && (
          <div className="absolute inset-0">
            <div className={styles.stormBackdrop} />
            <div className={styles.rainCloudCanopy}>
              <svg viewBox="0 0 1400 300" width="100%" height="100%" fill="none">
                <path
                  d="M 0 200 Q 180 80 420 170 Q 680 70 920 180 Q 1180 90 1400 210 L 1400 0 L 0 0 Z"
                  fill="rgba(15, 23, 42, 0.9)"
                />
              </svg>
            </div>
          </div>
        )}

        {/* 5. HEATWAVE BACKDROP */}
        {activeTheme === 'heatwave' && (
          <div className="absolute inset-0">
            <div className={styles.heatwaveBackdrop} />
          </div>
        )}

        {/* 6. FOG BACKDROP: Dynamic mist banks rolling across the background and clearing away */}
        {activeTheme === 'fog' && (
          <div className="absolute inset-0">
            <div className={styles.fogBackdrop} />
            <div className={styles.fogMist1} />
            <div className={styles.fogMist2} />
          </div>
        )}

        {/* 7. SNOW BACKDROP */}
        {activeTheme === 'snow' && (
          <div className="absolute inset-0">
            <div className={styles.snowBackdrop} />
            <div className={styles.frostVignette} />
          </div>
        )}
      </div>

      {/* ====================================================================
          LAYER 2: FOREGROUND WEATHER PARTICLES (z-index: 25, over cards, non-blocking)
          ==================================================================== */}
      <div className={styles.foregroundContainer} aria-hidden="true">
        {/* SUNNY: Kept 100% clean with zero clutter over cards (sunrays stay behind in backdrop) */}

        {/* 2. RAIN FOREGROUND: 90+ Diagonal Rain Streaks */}
        {activeTheme === 'rain' && (
          <div className="absolute inset-0">
            <div className={styles.rainContainer}>
              {Array.from({ length: 90 }).map((_, i) => {
                const isHeavy = i % 4 === 0;
                return (
                  <div
                    key={i}
                    className={isHeavy ? styles.rainDropHeavy : styles.rainDrop}
                    style={{
                      left: `${(i * 1.12) % 100}%`,
                      height: `${isHeavy ? 65 + (i % 6) * 16 : 45 + (i % 5) * 12}px`,
                      animationDuration: `${(isHeavy ? 0.62 : 0.72) + (i % 4) * 0.08}s`,
                      animationDelay: `${(i * 0.07) % 1.2}s`,
                      opacity: 0.7 + (i % 4) * 0.08,
                    }}
                  />
                );
              })}
            </div>
            <div className={styles.rainMist} />
          </div>
        )}

        {/* 3. THUNDERSTORM FOREGROUND: 110+ Storm Streaks + Lightning Flash + Bolt */}
        {activeTheme === 'thunderstorm' && (
          <div className="absolute inset-0">
            {/* Ambient Lightning Screen-Wide Flash */}
            <div className={styles.lightningFlash} />

            {/* Jagged High-Voltage Lightning Bolt */}
            <div className={styles.lightningBolt}>
              <svg viewBox="0 0 240 480" width="100%" height="100%" fill="none">
                <polyline
                  points="140,0 80,160 130,170 60,320 120,330 30,480"
                  stroke="#ffffff"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="miter"
                />
                <polyline
                  points="140,0 80,160 130,170 60,320 120,330 30,480"
                  stroke="#93c5fd"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="miter"
                  opacity="0.6"
                />
              </svg>
            </div>

            {/* 110 Heavy Rain Streaks */}
            <div className={styles.rainContainer}>
              {Array.from({ length: 110 }).map((_, i) => {
                const isHeavy = i % 3 === 0;
                return (
                  <div
                    key={i}
                    className={isHeavy ? styles.rainDropHeavy : styles.rainDrop}
                    style={{
                      left: `${(i * 0.92) % 100}%`,
                      height: `${60 + (i % 6) * 18}px`,
                      animationDuration: `${0.58 + (i % 4) * 0.07}s`,
                      animationDelay: `${(i * 0.05) % 1.0}s`,
                      opacity: 0.8 + (i % 3) * 0.1,
                    }}
                  />
                );
              })}
            </div>
            <div className={styles.rainMist} />
          </div>
        )}

        {/* 4. HEATWAVE FOREGROUND: Convective Shimmer Waves & Subtle Floating Embers */}
        {activeTheme === 'heatwave' && (
          <div className="absolute inset-0">
            <div className={styles.heatShimmer} />
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className={styles.heatEmber}
                style={{
                  width: `${5 + (i % 3) * 2}px`,
                  height: `${5 + (i % 3) * 2}px`,
                  left: `${(i * 4.2) % 100}%`,
                  animationDuration: `${7 + (i % 4) * 2}s`,
                  animationDelay: `${(i * 0.35) % 6}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* FOG: Kept 100% clean in foreground so cards & data remain fully readable (mist rolls in background and clears away) */}

        {/* 5. SNOW FOREGROUND: 65 Swirling Crystalline Snowflakes */}
        {activeTheme === 'snow' && (
          <div className="absolute inset-0">
            {Array.from({ length: 65 }).map((_, i) => (
              <div
                key={i}
                className={styles.snowFlake}
                style={{
                  left: `${(i * 1.55) % 100}%`,
                  width: `${5 + (i % 4) * 3}px`,
                  height: `${5 + (i % 4) * 3}px`,
                  animationDuration: `${5.5 + (i % 5) * 1.8}s`,
                  animationDelay: `${(i * 0.22) % 6}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ====================================================================
          ATMOSPHERE QUICK SWITCHER / STATUS PILL (Interactive, Bottom Right)
          ==================================================================== */}
      <div className={styles.atmoPill} style={{ pointerEvents: 'auto' }}>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 text-white hover:text-sky-200 transition-colors cursor-pointer"
          title="Atmospheric Environment Mode"
        >
          <span
            className={styles.atmoDot}
            style={{ background: currentMeta.dotColor, boxShadow: `0 0 8px ${currentMeta.dotColor}` }}
          />
          <span className="font-semibold text-xs tracking-wide">
            {currentMeta.icon}{' '}
            {manualTheme === null
              ? `${currentMeta.label} (Auto)`
              : manualTheme === 'simple'
              ? currentMeta.label
              : `${currentMeta.label} (Test)`}
          </span>
          <span className="text-[10px] opacity-70">▾</span>
        </button>

        {menuOpen && (
          <div
            className="absolute bottom-11 right-0 w-48 max-h-[380px] overflow-y-auto rounded-xl p-1.5 shadow-2xl backdrop-blur-xl border border-white/20 scrollbar-thin"
            style={{ background: 'rgba(15, 23, 42, 0.94)' }}
          >
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/10 mb-1">
              Select Atmosphere
            </div>
            <button
              type="button"
              onClick={() => {
                setManualTheme(null);
                setMenuOpen(false);
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                manualTheme === null ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-slate-300 hover:bg-white/10'
              }`}
            >
              <span>🌐 Auto (City Live)</span>
              {manualTheme === null && <span className="text-sky-400 text-[10px]">Active</span>}
            </button>
            {(Object.keys(THEME_LABELS) as AtmosphereTheme[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setManualTheme(t);
                  setMenuOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                  manualTheme === t ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                <span>
                  {THEME_LABELS[t].icon} {THEME_LABELS[t].label}
                </span>
                {manualTheme === t && <span className="text-sky-400 text-[10px]">Active</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default AtmosphereLayer;
