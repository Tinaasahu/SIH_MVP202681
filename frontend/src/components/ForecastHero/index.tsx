'use client';
import { useState, useEffect, useRef } from 'react';
import { CloudRain, Thermometer, Wind, Info, RefreshCw, HelpCircle, Sparkles } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { WhyForecastModal } from '@/components/WhyForecast';
import { getForecastMetrics, MOCK_FORECAST, getMetadata, formatLastUpdated } from '@/lib/api';
import type { ForecastMetrics } from '@/types';

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(value);
  const ref = useRef(value);

  useEffect(() => {
    const start = ref.current;
    const end = value;
    if (start === end) {
      setDisplay(end);
      return;
    }
    const duration = 800;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const current = start + (end - start) * ease;
      setDisplay(parseFloat(current.toFixed(decimals)));
      if (t < 1) requestAnimationFrame(tick);
      else {
        ref.current = end;
        setDisplay(end);
      }
    };
    requestAnimationFrame(tick);
  }, [value, decimals]);

  return <span>{display.toFixed(decimals)}</span>;
}

function ConfidenceRing({
  value,
  label,
  dominantModel,
  explanation,
}: {
  value: number;
  label?: string;
  dominantModel?: string;
  explanation?: string;
}) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 80 ? '#34d399' : value >= 60 ? '#fbbf24' : '#f87171';

  return (
    <Tooltip
      content={
        <div className="space-y-1.5 p-1 max-w-[240px] text-slate-200">
          <div className="flex items-center justify-between border-b border-white/10 pb-1">
            <span className="font-bold text-[#F5F7FF] text-xs">ECE Confidence</span>
            <span className="font-bold text-xs text-sky-400">{label || 'High'}</span>
          </div>
          {dominantModel && (
            <div className="text-[11px] text-[#AAB7D4]">
              Dominant Model: <span className="font-semibold text-[#F5F7FF]">{dominantModel}</span>
            </div>
          )}
          {explanation ? (
            <p className="text-[11px] text-[#AAB7D4] leading-snug italic bg-white/[0.05] p-1.5 rounded-lg border border-white/10">
              &quot;{explanation}&quot;
            </p>
          ) : (
            <ul className="space-y-1 text-[#AAB7D4] text-[11px]">
              {['Historical regional skill (50%)', 'Inter-model agreement (30%)', 'Lead-time decay curve (20%)'].map(f => (
                <li key={f} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      }
    >
      <div className="flex flex-col items-center justify-center cursor-help">
        <svg width="84" height="84" viewBox="0 0 84 84">
          <circle
            cx="42" cy="42" r={radius}
            fill="none" strokeWidth="5.5"
            stroke="currentColor"
            className="text-slate-200 dark:text-white/10"
            style={{ stroke: 'var(--card-sub-border, rgba(255,255,255,0.08))' }}
          />
          <circle
            cx="42" cy="42" r={radius}
            fill="none" strokeWidth="5.5"
            stroke="#10b981"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 42 42)"
            style={{
              transition: 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)',
              filter: 'drop-shadow(0 0 3px rgba(16, 185, 129, 0.45))'
            }}
          />
          <text
            x="42" y="42"
            textAnchor="middle"
            dominantBaseline="central"
            fill="currentColor"
            fontSize="18"
            fontWeight="800"
            style={{ fill: 'var(--text-primary, #14213d)' }}
          >
            {value}%
          </text>
        </svg>
        <span
          className="text-[11px] font-semibold mt-1.5"
          style={{ color: 'var(--text-primary, #14213d)' }}
        >
          {label ? `${label} Confidence` : 'Blend Reliability'}
        </span>
        <span
          className="text-[10px]"
          style={{ color: 'var(--text-secondary, #566075)' }}
        >
          {dominantModel ? `Dominant: ${dominantModel}` : 'High Agreement'}
        </span>
      </div>
    </Tooltip>
  );
}

interface ForecastHeroProps {
  selectedCity?: string | null;
}

export function ForecastHero({ selectedCity = 'Kanpur' }: ForecastHeroProps) {
  const city = selectedCity || 'Kanpur';
  const [whyOpen, setWhyOpen] = useState(false);
  const [forecast, setForecast] = useState<ForecastMetrics>(MOCK_FORECAST);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [lastUpdatedError, setLastUpdatedError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    let mounted = true;
    getForecastMetrics(city)
      .then((data) => {
        if (mounted && data) {
          setForecast(data);
          setIsFallback(data === MOCK_FORECAST);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsError(true);
          setIsFallback(true);
          setIsLoading(false);
        }
      });

    getMetadata()
      .then((meta) => {
        if (mounted && meta?.last_updated) {
          setLastUpdated(meta.last_updated);
        } else if (mounted) {
          setLastUpdatedError(true);
        }
      })
      .catch(() => {
        if (mounted) {
          setLastUpdatedError(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [city]);

  const lastUpdatedDisplay = lastUpdated ? formatLastUpdated(lastUpdated) : null;

  const metrics = [
    {
      icon: CloudRain,
      label: 'Rainfall',
      value: forecast.rainfall,
      unit: 'mm',
      uncertainty: `±${forecast.rainfallUncertainty} mm`,
      color: '#38bdf8',
      decimals: 0,
    },
    {
      icon: Thermometer,
      label: 'Temperature',
      value: forecast.temperature,
      unit: '°C',
      uncertainty: `±${forecast.temperatureUncertainty} °C`,
      color: '#f59e0b',
      decimals: 1,
    },
    {
      icon: Wind,
      label: 'Wind Speed',
      value: forecast.wind,
      unit: 'km/h',
      uncertainty: `±${forecast.windUncertainty} km/h`,
      color: '#22d3ee',
      decimals: 0,
    },
  ];

  return (
    <>
      <div
        className="rounded-2xl p-6 sm:p-8 relative overflow-hidden transition-all duration-300"
        style={{
          background: 'var(--glass-bg, rgba(8, 14, 35, 0.52))',
          backdropFilter: 'var(--glass-backdrop, blur(24px) saturate(115%))',
          WebkitBackdropFilter: 'var(--glass-backdrop, blur(24px) saturate(115%))',
          border: 'var(--glass-border, 1px solid rgba(220, 225, 255, 0.12))',
          boxShadow: 'var(--glass-shadow, 0 16px 45px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.06))',
          borderRadius: 'var(--card-radius, 20px)',
        }}
      >
        <div className="relative">
          {/* Top Headline Section */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <span
                  className="text-xs font-extrabold tracking-widest text-sky-400 uppercase"
                  style={{ letterSpacing: '0.14em' }}
                >
                  HYBRID FORECAST INTELLIGENCE
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/[0.06] text-[#F3F5FA] border border-white/12 shadow-sm">
                  <Sparkles size={11} className="text-amber-300" />
                  Optimal Dynamic Blend
                </span>
                {isFallback && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                    Demo data (backend unavailable)
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#F3F5FA] tracking-tight">
                AI + NWP + Multi-Model Ensemble → One Coherent Forecast
              </h1>
              <p className="text-xs text-[#A9B2C8] mt-1">
                Adaptive weighting dynamically calibrated for region, season, lead-time, and active regime
              </p>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setWhyOpen(true)}
              className="text-[#F3F5FA] hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border-white/12 shadow-sm"
            >
              <HelpCircle size={15} />
              Why this forecast?
            </Button>
          </div>

          {/* Metrics Grid with Lighter Internal Glass Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="rounded-2xl p-5 transition-all hover:translate-y-[-2px] hover:shadow-lg"
                style={{
                  background: 'var(--card-sub-bg, rgba(15, 21, 45, 0.48))',
                  backdropFilter: 'var(--glass-backdrop, blur(20px))',
                  WebkitBackdropFilter: 'var(--glass-backdrop, blur(20px))',
                  border: 'var(--card-sub-border, 1px solid rgba(220, 225, 255, 0.10))',
                  boxShadow: 'var(--card-sub-shadow, 0 12px 30px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.05))',
                  borderRadius: 'var(--card-radius, 18px)',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: `${m.color}18` }}
                  >
                    <m.icon size={15} style={{ color: m.color }} />
                  </div>
                  <span className="text-xs text-[#A9B2C8] font-bold uppercase tracking-wider">{m.label}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-extrabold text-[#F3F5FA] tracking-tight">
                    <AnimatedNumber value={m.value} decimals={m.decimals} />
                  </span>
                  <span className="text-base font-bold" style={{ color: m.color }}>{m.unit}</span>
                </div>
                <div className="mt-2.5 text-xs text-[#747F9C] font-medium">
                  Uncertainty: <span className="font-semibold text-[#A9B2C8]">{m.uncertainty}</span>
                </div>
              </div>
            ))}

            {/* Confidence Ring Card - Soft Mint Green Accent */}
            <div
              className="rounded-2xl p-5 flex flex-col items-center justify-center transition-all hover:translate-y-[-2px] hover:shadow-lg"
              style={{
                background: 'var(--card-sub-bg, rgba(15, 21, 45, 0.48))',
                backdropFilter: 'var(--glass-backdrop, blur(20px))',
                WebkitBackdropFilter: 'var(--glass-backdrop, blur(20px))',
                border: 'var(--card-sub-border, 1px solid rgba(220, 225, 255, 0.10))',
                boxShadow: 'var(--card-sub-shadow, 0 12px 30px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.05))',
                borderRadius: 'var(--card-radius, 18px)',
              }}
            >
              <ConfidenceRing
                value={forecast.confidence}
                label={forecast.confidenceLabel}
                dominantModel={forecast.dominantModel}
                explanation={forecast.explanation}
              />
            </div>
          </div>

          {/* Footer Metadata */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-3.5 border-t border-white/[0.08]">
            <div className="flex items-center gap-2 text-xs text-[#747F9C]">
              <RefreshCw size={13} className="text-sky-400 animate-spin" style={{ animationDuration: '8s' }} />
              {lastUpdatedDisplay ? (
                <span>Last Updated: {lastUpdatedDisplay}</span>
              ) : lastUpdatedError ? (
                <span>Last Updated: {formatLastUpdated()}</span>
              ) : (
                <span className="inline-block w-28 h-3.5 bg-white/10 animate-pulse rounded" aria-label="Loading last updated time" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-[#A9B2C8]">
              <span className="font-medium text-[#F3F5FA]">Target Station: {city}</span>
              <span className="text-[#747F9C]">·</span>
              <span>Lead Time: 24h</span>
              <span className="text-[#747F9C]">·</span>
              <span className="text-emerald-400 font-semibold">Active Monsoon Regime</span>
            </div>
          </div>
        </div>
      </div>

      <WhyForecastModal open={whyOpen} onClose={() => setWhyOpen(false)} selectedCity={city} />
    </>
  );
}
