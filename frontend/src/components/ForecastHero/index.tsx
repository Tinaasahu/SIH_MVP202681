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
  const [display, setDisplay] = useState(0);
  const ref = useRef(0);

  useEffect(() => {
    const start = ref.current;
    const end = value;
    const duration = 800;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const current = start + (end - start) * ease;
      setDisplay(parseFloat(current.toFixed(decimals)));
      if (t < 1) requestAnimationFrame(tick);
      else ref.current = end;
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
  const color = value >= 80 ? '#10b981' : value >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <Tooltip
      content={
        <div className="space-y-1.5 p-1 max-w-[240px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1">
            <span className="font-bold text-slate-800 text-xs">ECE Confidence</span>
            <span className="font-bold text-xs text-blue-600">{label || 'High'}</span>
          </div>
          {dominantModel && (
            <div className="text-[11px] text-slate-600">
              Dominant Model: <span className="font-semibold text-slate-800">{dominantModel}</span>
            </div>
          )}
          {explanation ? (
            <p className="text-[11px] text-slate-600 leading-snug italic bg-blue-50/70 p-1.5 rounded-lg border border-blue-100/70">
              &quot;{explanation}&quot;
            </p>
          ) : (
            <ul className="space-y-1 text-slate-600 text-[11px]">
              {['Historical regional skill (50%)', 'Inter-model agreement (30%)', 'Lead-time decay curve (20%)'].map(f => (
                <li key={f} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
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
          <circle cx="42" cy="42" r={radius} fill="none" strokeWidth="6" stroke="rgba(148,163,184,0.18)" />
          <circle
            cx="42" cy="42" r={radius}
            fill="none" strokeWidth="6"
            stroke={color}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 42 42)"
            style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)' }}
          />
          <text x="42" y="42" textAnchor="middle" dominantBaseline="central" fill={color} fontSize="17" fontWeight="800">
            {value}%
          </text>
        </svg>
        <span className="text-[11px] font-semibold text-slate-700 mt-1">
          {label ? `${label} Confidence` : 'Blend Reliability'}
        </span>
        <span className="text-[10px] text-slate-400">
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
  const [lastUpdated, setLastUpdated] = useState<string>('2026-09-26T23:45:12');
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let mounted = true;
    getForecastMetrics(city)
      .then((data) => {
        if (mounted && data) {
          setForecast(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsError(true);
          setIsLoading(false);
        }
      });

    getMetadata()
      .then((meta) => {
        if (mounted && meta?.last_updated) {
          setLastUpdated(meta.last_updated);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [city]);

  const lastUpdatedDisplay = formatLastUpdated(lastUpdated);

  const metrics = [
    {
      icon: CloudRain,
      label: 'Rainfall',
      value: forecast.rainfall,
      unit: 'mm',
      uncertainty: `±${forecast.rainfallUncertainty} mm`,
      color: '#0284c7',
      decimals: 0,
      bg: 'linear-gradient(145deg, rgba(239, 246, 255, 0.94) 0%, rgba(219, 234, 254, 0.78) 100%)',
      border: 'rgba(186, 230, 253, 0.9)',
      shadow: '0 8px 24px -2px rgba(2, 132, 199, 0.1), inset 0 1px 1px 0 rgba(255, 255, 255, 0.95)',
    },
    {
      icon: Thermometer,
      label: 'Temperature',
      value: forecast.temperature,
      unit: '°C',
      uncertainty: `±${forecast.temperatureUncertainty} °C`,
      color: '#ea580c',
      decimals: 1,
      bg: 'linear-gradient(145deg, rgba(255, 247, 237, 0.94) 0%, rgba(254, 237, 213, 0.78) 100%)',
      border: 'rgba(254, 215, 170, 0.9)',
      shadow: '0 8px 24px -2px rgba(234, 88, 12, 0.1), inset 0 1px 1px 0 rgba(255, 255, 255, 0.95)',
    },
    {
      icon: Wind,
      label: 'Wind Speed',
      value: forecast.wind,
      unit: 'km/h',
      uncertainty: `±${forecast.windUncertainty} km/h`,
      color: '#dc2626',
      decimals: 0,
      bg: 'linear-gradient(145deg, rgba(254, 242, 242, 0.94) 0%, rgba(254, 226, 226, 0.78) 100%)',
      border: 'rgba(254, 202, 202, 0.9)',
      shadow: '0 8px 24px -2px rgba(220, 38, 38, 0.1), inset 0 1px 1px 0 rgba(255, 255, 255, 0.95)',
    },
  ];

  return (
    <>
      <GlassCard padding="lg" variant="default" className="relative overflow-hidden">
        {/* Subtle Atmospheric Refraction Glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 70% 60% at 85% 15%, rgba(14,165,233,0.08) 0%, transparent 65%)',
          }}
        />

        <div className="relative">
          {/* Top Headline Section */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <span
                  className="text-xs font-extrabold tracking-widest text-blue-600 uppercase"
                  style={{ letterSpacing: '0.14em' }}
                >
                  HYBRID FORECAST INTELLIGENCE
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 shadow-2xs">
                  <Sparkles size={11} className="text-blue-500" />
                  Optimal Dynamic Blend
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">
                AI + NWP + Multi-Model Ensemble → One Coherent Forecast
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Adaptive weighting dynamically calibrated for region, season, lead-time, and active regime
              </p>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setWhyOpen(true)}
              className="text-slate-700 hover:text-blue-600 bg-white/80 border-slate-200/80 shadow-xs"
            >
              <HelpCircle size={15} />
              Why this forecast?
            </Button>
          </div>

          {/* Metrics Grid with Blue, Orange, Red & Yellow Glass Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="rounded-2xl p-5 transition-all hover:translate-y-[-2px] hover:shadow-md"
                style={{
                  background: m.bg,
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: `1px solid ${m.border}`,
                  boxShadow: m.shadow,
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shadow-2xs"
                    style={{ background: `${m.color}15` }}
                  >
                    <m.icon size={15} style={{ color: m.color }} />
                  </div>
                  <span className="text-xs text-slate-600 font-bold uppercase tracking-wider">{m.label}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-extrabold text-slate-800 tracking-tight">
                    <AnimatedNumber value={m.value} decimals={m.decimals} />
                  </span>
                  <span className="text-base font-bold text-slate-500">{m.unit}</span>
                </div>
                <div className="mt-2.5 text-xs text-slate-500 font-medium">
                  Uncertainty: <span className="font-semibold text-slate-700">{m.uncertainty}</span>
                </div>
              </div>
            ))}

            {/* Confidence Ring Card - Yellow/Gold Accent */}
            <div
              className="rounded-2xl p-5 flex flex-col items-center justify-center transition-all hover:translate-y-[-2px] hover:shadow-md"
              style={{
                background: 'linear-gradient(145deg, rgba(254, 252, 232, 0.94) 0%, rgba(254, 249, 195, 0.78) 100%)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(253, 224, 71, 0.9)',
                boxShadow: '0 8px 24px -2px rgba(202, 138, 4, 0.1), inset 0 1px 1px 0 rgba(255, 255, 255, 0.95)',
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
          <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-3.5 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <RefreshCw size={13} className="text-blue-500 animate-spin" style={{ animationDuration: '8s' }} />
              <span>Last Updated: {lastUpdatedDisplay}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">Target Station: {city}</span>
              <span className="text-slate-300">·</span>
              <span>Lead Time: 24h</span>
              <span className="text-slate-300">·</span>
              <span className="text-emerald-600 font-semibold">Active Monsoon Regime</span>
            </div>
          </div>
        </div>
      </GlassCard>

      <WhyForecastModal open={whyOpen} onClose={() => setWhyOpen(false)} selectedCity={city} />
    </>
  );
}
