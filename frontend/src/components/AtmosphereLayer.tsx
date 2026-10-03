'use client';

import React, { useMemo, useState, useEffect } from 'react';
import styles from './atmosphere.module.css';

export interface AtmosphereLayerProps {
  condition?: string;
  rainfall?: number;
  temperature?: number;
  wind?: number;
  alert_type?: string;
}

export type AtmosphereTheme = 
  | 'simple' 
  | 'morning' 
  | 'sunny' 
  | 'evening' 
  | 'night' 
  | 'cloudy' 
  | 'rain' 
  | 'thunderstorm' 
  | 'heatwave' 
  | 'fog' 
  | 'snow';

/** Deterministic star positions for clean hydration */
const NIGHT_STARS = [
  { top: '8%', left: '12%', size: 2, delay: '0s' },
  { top: '15%', left: '28%', size: 3, delay: '1.2s' },
  { top: '22%', left: '45%', size: 1.5, delay: '0.4s' },
  { top: '10%', left: '62%', size: 2.5, delay: '2.1s' },
  { top: '18%', left: '78%', size: 2, delay: '0.9s' },
  { top: '25%', left: '90%', size: 1.5, delay: '1.7s' },
  { top: '32%', left: '18%', size: 2, delay: '0.6s' },
  { top: '38%', left: '34%', size: 1.5, delay: '2.4s' },
  { top: '45%', left: '55%', size: 2.5, delay: '1.1s' },
  { top: '50%', left: '72%', size: 1.8, delay: '0.3s' },
  { top: '58%', left: '85%', size: 2.2, delay: '1.9s' },
  { top: '12%', left: '38%', size: 2, delay: '2.7s' },
  { top: '28%', left: '6%', size: 1.5, delay: '1.4s' },
  { top: '65%', left: '22%', size: 2.4, delay: '0.8s' },
  { top: '72%', left: '48%', size: 1.6, delay: '2.2s' },
  { top: '80%', left: '68%', size: 2, delay: '1.5s' },
  { top: '85%', left: '14%', size: 1.8, delay: '0.5s' },
  { top: '42%', left: '92%', size: 2.2, delay: '2.8s' },
];

/**
 * Returns the current hour in Indian Standard Time (IST - Asia/Kolkata).
 */
export function getISTHour(): number {
  try {
    const istTimeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: 'numeric',
    }).format(new Date());
    const h = parseInt(istTimeStr, 10);
    return isNaN(h) ? new Date().getHours() : h;
  } catch {
    return new Date().getHours();
  }
}

/**
 * Resolves the atmospheric theme according to live blended weather values and diurnal IST cycle.
 */
export function resolveAtmosphereTheme(
  condition?: string,
  rainfall: number = 0,
  temperature: number = 28,
  wind: number = 12,
  alert_type?: string,
  forcedHour?: number
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
  if (cond.includes('cloud') || cond.includes('overcast') || rainfall > 1 || wind > 25) {
    return 'cloudy';
  }

  // 7. Diurnal Clear Cycle based on Indian Standard Time (IST)
  const hour = forcedHour !== undefined ? forcedHour : getISTHour();
  if (hour >= 5 && hour < 11) {
    return 'morning';
  }
  if (hour >= 11 && hour < 17) {
    return 'sunny';
  }
  if (hour >= 17 && hour < 20) {
    return 'evening';
  }
  return 'night';
}

const THEME_LABELS: Record<AtmosphereTheme, { label: string; icon: string; dotColor: string; category: string }> = {
  simple: { label: 'Simple UI', icon: '✨', dotColor: '#94a3b8', category: 'General' },
  morning: { label: 'Morning Dawn', icon: '🌅', dotColor: '#f59e0b', category: 'Diurnal' },
  sunny: { label: 'Bright Afternoon', icon: '☀️', dotColor: '#eab308', category: 'Diurnal' },
  evening: { label: 'Golden Sunset', icon: '🌇', dotColor: '#f97316', category: 'Diurnal' },
  night: { label: 'Clear Night', icon: '🌙', dotColor: '#6366f1', category: 'Diurnal' },
  rain: { label: 'Rain', icon: '🌧️', dotColor: '#60a5fa', category: 'Weather' },
  thunderstorm: { label: 'Thunderstorm', icon: '⚡', dotColor: '#a855f7', category: 'Weather' },
  cloudy: { label: 'Cloudy', icon: '☁️', dotColor: '#94a3b8', category: 'Weather' },
  heatwave: { label: 'Heatwave', icon: '🔥', dotColor: '#ef4444', category: 'Weather' },
  fog: { label: 'Fog', icon: '🌫️', dotColor: '#cbd5e1', category: 'Weather' },
  snow: { label: 'Snow', icon: '❄️', dotColor: '#67e8f9', category: 'Weather' },
};

export interface AtmosphereLayerProps {
  condition?: string;
  rainfall?: number;
  temperature?: number;
  wind?: number;
  alert_type?: string;
  themeMode?: AtmosphereTheme | null;
  onThemeChange?: (theme: AtmosphereTheme | null) => void;
}

export function AtmosphereLayer({
  condition,
  rainfall = 0,
  temperature = 28,
  wind = 12,
  alert_type,
  themeMode,
  onThemeChange,
}: AtmosphereLayerProps) {
  const [manualTheme, setManualTheme] = useState<AtmosphereTheme | null>(themeMode !== undefined ? themeMode : null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentHour, setCurrentHour] = useState<number>(getISTHour());

  // Keep internal manualTheme synced with prop if passed
  useEffect(() => {
    if (themeMode !== undefined) {
      setManualTheme(themeMode);
    }
  }, [themeMode]);

  useEffect(() => {
    // Automatically checks IST hour every 10 seconds for seamless real-time transitions
    const interval = setInterval(() => {
      setCurrentHour(getISTHour());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const autoTheme = useMemo(
    () => resolveAtmosphereTheme(condition, rainfall, temperature, wind, alert_type, currentHour),
    [condition, rainfall, temperature, wind, alert_type, currentHour]
  );

  const activeTheme = manualTheme || autoTheme;
  const currentMeta = THEME_LABELS[activeTheme];

  // Sync data-theme-mode attribute on document root
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (activeTheme === 'simple') {
        document.documentElement.setAttribute('data-theme-mode', 'simple');
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.documentElement.removeAttribute('data-theme-mode');
        document.documentElement.removeAttribute('data-theme');
      }
    }
  }, [activeTheme]);

  const handleSelectTheme = (t: AtmosphereTheme | null) => {
    setManualTheme(t);
    setMenuOpen(false);
    if (onThemeChange) {
      onThemeChange(t);
    }
  };

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

        {/* 1. MORNING BACKDROP: Soft golden dawn, rising sun with fresh warm glow */}
        {activeTheme === 'morning' && (
          <div className="absolute inset-0">
            <div className={styles.morningBackdrop} />
            <div className={styles.morningSun} />
            <div className={styles.morningMist} />
          </div>
        )}

        {/* 2. BRIGHT AFTERNOON (SUNNY) BACKDROP: Warm golden yellow sky with sun rays behind */}
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

        {/* 3. EVENING (DUSK/SUNSET) BACKDROP: Premium Stylized Vector Sunset Landscape */}
        {activeTheme === 'evening' && (
          <div className="absolute inset-0">
            <div className={styles.eveningBackdrop} />
            <div className={styles.sunsetUiVignette} />
          </div>
        )}

        {/* 4. NIGHT BACKDROP: Cinematic realistic night landscape with mountains, lake, glowing moon and stars */}
        {activeTheme === 'night' && (
          <div className="absolute inset-0">
            <div className={styles.nightBackdrop} />
            <div className={styles.nightUiVignette} />
            <div className={styles.gentleMoonGlow} />
            <div className={styles.nightStars}>
              {NIGHT_STARS.map((s, idx) => (
                <div
                  key={idx}
                  className={styles.star}
                  style={{
                    top: s.top,
                    left: s.left,
                    width: `${s.size}px`,
                    height: `${s.size}px`,
                    animationDelay: s.delay,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* 5. CLOUDY BACKDROP */}
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
                      left: `${(i * 0.91) % 100}%`,
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
          className="flex items-center gap-2.5 text-[#FFF7DC] hover:text-white transition-all cursor-pointer py-0.5 px-1"
          title={`Atmospheric Environment Mode (${currentMeta.label})`}
        >
          <span
            className={styles.atmoDot}
            style={{ background: currentMeta.dotColor, boxShadow: `0 0 8px ${currentMeta.dotColor}99` }}
          />
          <div className="flex flex-col text-left leading-tight">
            <span className="font-bold text-xs tracking-wide flex items-center gap-1.5 text-[#FFF7DC]">
              <span>{currentMeta.icon}</span>
              <span>{currentMeta.label}</span>
              <span className="text-[10px] font-normal text-[#A9B2C8]">
                • {temperature.toFixed(0)}°C
              </span>
            </span>
          </div>
          <span className="text-[10px] opacity-60 ml-0.5 text-[#A9B2C8]">▾</span>
        </button>

        {menuOpen && (
          <div
            className="absolute bottom-12 right-0 w-56 max-h-[440px] overflow-y-auto rounded-xl p-2 shadow-2xl backdrop-blur-2xl border border-white/20 scrollbar-thin"
            style={{ background: 'rgba(11, 17, 32, 0.96)', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.7), 0 0 20px rgba(56, 189, 248, 0.15)' }}
          >
            <div className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-widest text-sky-400/90 border-b border-white/10 mb-1 flex items-center justify-between">
              <span>Atmospheric Mode</span>
              <span className="text-[9px] text-slate-400 font-normal">IST Synced</span>
            </div>

            {/* Auto Live Option */}
            <button
              type="button"
              onClick={() => handleSelectTheme(null)}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors mb-1.5 ${
                manualTheme === null
                  ? 'bg-sky-500/25 text-sky-300 font-bold border border-sky-400/30'
                  : 'text-slate-300 hover:bg-white/10'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span>🌐</span>
                <span>Auto Live (IST Diurnal)</span>
              </span>
              {manualTheme === null && (
                <span className="text-[10px] bg-sky-400/20 text-sky-300 px-1.5 py-0.2 rounded font-semibold">Active</span>
              )}
            </button>

            {/* Diurnal Sky Cycle */}
            <div className="px-2 pt-1.5 pb-1 text-[9px] font-bold uppercase tracking-wider text-amber-400/80 border-t border-white/10">
              Diurnal Sky (Clear)
            </div>
            {(['morning', 'sunny', 'evening', 'night'] as AtmosphereTheme[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleSelectTheme(t)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                  manualTheme === t
                    ? 'bg-amber-500/25 text-amber-200 font-bold border border-amber-400/30'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span>{THEME_LABELS[t].icon}</span>
                  <span>{THEME_LABELS[t].label}</span>
                </span>
                {manualTheme === t && <span className="text-amber-400 text-[10px]">Active</span>}
              </button>
            ))}

            {/* Weather & Hazards */}
            <div className="px-2 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-rose-400/80 border-t border-white/10 mt-1">
              Hazard & Weather Presets
            </div>
            {(['rain', 'thunderstorm', 'heatwave', 'fog', 'cloudy', 'snow'] as AtmosphereTheme[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleSelectTheme(t)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                  manualTheme === t
                    ? 'bg-rose-500/25 text-rose-200 font-bold border border-rose-400/30'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span>{THEME_LABELS[t].icon}</span>
                  <span>{THEME_LABELS[t].label}</span>
                </span>
                {manualTheme === t && <span className="text-rose-400 text-[10px]">Active</span>}
              </button>
            ))}

            {/* Simple Mode */}
            <div className="border-t border-white/10 mt-1 pt-1">
              <button
                type="button"
                onClick={() => handleSelectTheme('simple')}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                  manualTheme === 'simple'
                    ? 'bg-slate-500/25 text-slate-200 font-bold border border-slate-400/30'
                    : 'text-slate-400 hover:bg-white/10'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span>✨</span>
                  <span>Simple Minimalist UI</span>
                </span>
                {manualTheme === 'simple' && <span className="text-slate-400 text-[10px]">Active</span>}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default AtmosphereLayer;
