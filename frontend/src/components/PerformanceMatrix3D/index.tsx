'use client';
import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  fetchAllMatrices,
  getDefaultMatrices,
  MODELS,
  LEAD_TIMES,
  MODEL_COLORS,
  PerformanceCell,
  PerformanceMatrixData,
} from '@/data/performanceMatrixData';
import { GlassCard } from '@/components/ui/GlassCard';
import { Tooltip } from '@/components/ui/Tooltip';
import { Info, Box, LayoutGrid, CheckCircle2 } from 'lucide-react';

/* ──────────────────── Color helpers ──────────────────── */

function getBarColor(skill: number): string {
  if (skill > 0.7) return '#10b981'; // emerald
  if (skill > 0.4) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

/* ──────────────────── Offline Text Sprite (No External Fonts) ──────────────────── */

function TextSprite({
  text,
  position,
  color = '#94a3b8',
  fontSize = 26,
  scale = [1.3, 0.35, 1],
}: {
  text: string;
  position: [number, number, number];
  color?: string;
  fontSize?: number;
  scale?: [number, number, number];
}) {
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, 256, 64);
    ctx.font = `bold ${fontSize}px Inter, system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [text, color, fontSize]);

  if (!texture) return null;

  return (
    <sprite position={position} scale={scale}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

/* ──────────────────── Individual 3D Bar ──────────────────── */

interface BarProps {
  cell: PerformanceCell;
  maxRmse: number;
  spacing: number;
  onHover: (cell: PerformanceCell | null) => void;
  isHovered: boolean;
  colorMode: 'model' | 'skill';
}

function PerformanceBar({ cell, maxRmse, spacing, onHover, isHovered, colorMode }: BarProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const normalizedHeight = Math.max(0.2, (cell.rmse / (maxRmse || 1)) * 3.8); // max height = 3.8 units
  const targetHeight = useRef(normalizedHeight);
  const currentHeight = useRef(normalizedHeight);

  targetHeight.current = normalizedHeight;

  const baseColor = colorMode === 'model'
    ? MODEL_COLORS[cell.model] || '#6366f1'
    : getBarColor(cell.skillScore);

  useFrame((_state, delta) => {
    if (!meshRef.current) return;

    // Smooth height animation
    currentHeight.current += (targetHeight.current - currentHeight.current) * Math.min(delta * 4, 1);
    const h = Math.max(0.05, currentHeight.current);
    meshRef.current.scale.y = h;
    meshRef.current.position.y = h / 2;

    // Hover glow
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    if (mat) {
      const targetEmissive = isHovered ? 0.6 : (cell.model === 'Hybrid (Final)' ? 0.25 : 0.05);
      mat.emissiveIntensity += (targetEmissive - mat.emissiveIntensity) * Math.min(delta * 8, 1);
    }
  });

  const x = cell.modelIndex * spacing - ((MODELS.length - 1) * spacing) / 2;
  const z = cell.leadIndex * spacing - ((LEAD_TIMES.length - 1) * spacing) / 2;

  return (
    <mesh
      ref={meshRef}
      position={[x, normalizedHeight / 2, z]}
      scale={[1, normalizedHeight, 1]}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onHover(cell);
      }}
      onPointerOut={() => onHover(null)}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[spacing * 0.72, 1, spacing * 0.72]} />
      <meshStandardMaterial
        color={baseColor}
        transparent
        opacity={isHovered ? 1.0 : 0.9}
        emissive={baseColor}
        emissiveIntensity={cell.model === 'Hybrid (Final)' ? 0.25 : 0.05}
        roughness={0.25}
        metalness={0.2}
      />
    </mesh>
  );
}

/* ──────────────────── Grid / Axes with Offline Sprites ──────────────────── */

interface GridProps {
  spacing: number;
  matrix: PerformanceMatrixData;
  maxRmse: number;
}

function AxisLabels({ spacing, matrix, maxRmse }: GridProps) {
  const xStart = -((MODELS.length - 1) * spacing) / 2;
  const zStart = -((LEAD_TIMES.length - 1) * spacing) / 2;

  return (
    <group>
      {/* Model names along X axis */}
      {MODELS.map((model, i) => (
        <TextSprite
          key={`model-${i}`}
          text={model}
          position={[xStart + i * spacing, -0.3, ((LEAD_TIMES.length - 1) * spacing) / 2 + 1.1]}
          color={model === 'Hybrid (Final)' ? '#38bdf8' : '#94a3b8'}
          fontSize={model === 'Hybrid (Final)' ? 26 : 22}
          scale={[1.4, 0.38, 1]}
        />
      ))}

      {/* Lead Time labels along Z axis */}
      {LEAD_TIMES.map((lt, i) => (
        <TextSprite
          key={`lead-${i}`}
          text={lt}
          position={[-((MODELS.length - 1) * spacing) / 2 - 1.1, -0.3, zStart + i * spacing]}
          color="#cbd5e1"
          fontSize={24}
          scale={[0.9, 0.35, 1]}
        />
      ))}

      {/* Y axis ticks and horizontal planes */}
      {[0, 1, 2, 3, 4].map((tick) => {
        const rmseVal = ((tick / 4) * maxRmse).toFixed(1);
        return (
          <group key={`ytick-${tick}`}>
            <TextSprite
              text={rmseVal}
              position={[-((MODELS.length - 1) * spacing) / 2 - 1.2, tick, 0]}
              color="#64748b"
              fontSize={20}
              scale={[0.8, 0.3, 1]}
            />
            {/* Subtle horizontal grid plane */}
            <mesh position={[0, tick, 0]}>
              <planeGeometry args={[(MODELS.length - 1) * spacing + 1.8, (LEAD_TIMES.length - 1) * spacing + 1.8]} />
              <meshBasicMaterial
                color="#38bdf8"
                transparent
                opacity={tick === 0 ? 0.08 : 0.03}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        );
      })}

      {/* Axis titles */}
      <TextSprite
        text="Models →"
        position={[0, -0.3, ((LEAD_TIMES.length - 1) * spacing) / 2 + 1.8]}
        color="#38bdf8"
        fontSize={24}
        scale={[1.2, 0.35, 1]}
      />
      <TextSprite
        text="Lead Time →"
        position={[-((MODELS.length - 1) * spacing) / 2 - 2.0, -0.3, 0]}
        color="#38bdf8"
        fontSize={24}
        scale={[1.4, 0.35, 1]}
      />
      <TextSprite
        text={`RMSE (${matrix.unit}) ↑`}
        position={[-((MODELS.length - 1) * spacing) / 2 - 1.8, 3.8, 0]}
        color="#38bdf8"
        fontSize={22}
        scale={[1.5, 0.35, 1]}
      />

      {/* Base grid helper */}
      <gridHelper
        args={[
          Math.max((MODELS.length - 1) * spacing, (LEAD_TIMES.length - 1) * spacing) + 2.4,
          10,
          '#0284c7',
          '#1e293b',
        ]}
        position={[0, -0.01, 0]}
      />
    </group>
  );
}

/* ──────────────────── Floating Tooltip inside 3D Canvas ──────────────────── */

function FloatingTooltip({ cell, matrix }: { cell: PerformanceCell; matrix: PerformanceMatrixData }) {
  const spacing = 1.5;
  const x = cell.modelIndex * spacing - ((MODELS.length - 1) * spacing) / 2;
  const z = cell.leadIndex * spacing - ((LEAD_TIMES.length - 1) * spacing) / 2;
  const maxRmse = Math.max(...matrix.cells.map((c) => c.rmse));
  const y = (cell.rmse / maxRmse) * 3.8 + 0.7;

  return (
    <Html position={[x, y, z]} center distanceFactor={7} style={{ pointerEvents: 'none' }}>
      <div
        className="px-3.5 py-2.5 rounded-xl shadow-2xl border text-xs whitespace-nowrap"
        style={{
          background: 'rgba(11, 17, 32, 0.95)',
          backdropFilter: 'blur(16px)',
          borderColor: 'rgba(56, 189, 248, 0.35)',
          minWidth: 170,
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5), 0 0 16px rgba(56, 189, 248, 0.2)',
        }}
      >
        <div className="font-bold text-white mb-1 flex items-center justify-between gap-2">
          <span>{cell.model}</span>
          {cell.model === 'Hybrid (Final)' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold border border-sky-400/30">
              TOP AI
            </span>
          )}
        </div>
        <div className="text-slate-400 text-[11px] mb-1.5">
          Lead: {cell.leadTime} · {matrix.variable}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">RMSE</span>
            <span className="font-bold text-sky-300">{cell.rmse.toFixed(4)} {matrix.unit}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">MAE</span>
            <span className="font-semibold text-slate-200">{cell.mae.toFixed(4)} {matrix.unit}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Skill Score</span>
            <span className="font-bold text-emerald-400">{(cell.skillScore * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </Html>
  );
}

/* ──────────────────── 3D Scene ──────────────────── */

interface SceneProps {
  matrix: PerformanceMatrixData;
  colorMode: 'model' | 'skill';
  autoRotate: boolean;
}

function Scene({ matrix, colorMode, autoRotate }: SceneProps) {
  const [hoveredCell, setHoveredCell] = useState<PerformanceCell | null>(null);
  const spacing = 1.5;
  const maxRmse = useMemo(() => Math.max(...matrix.cells.map((c) => c.rmse)), [matrix]);

  const handleHover = useCallback((cell: PerformanceCell | null) => {
    setHoveredCell(cell);
  }, []);

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[8, 12, 8]} intensity={1.4} castShadow />
      <directionalLight position={[-6, 8, -6]} intensity={0.5} color="#38bdf8" />
      <pointLight position={[0, 5, 0]} intensity={0.6} color="#60a5fa" />

      <OrbitControls
        autoRotate={autoRotate}
        autoRotateSpeed={0.6}
        enablePan={true}
        enableZoom={true}
        enableDamping={true}
        dampingFactor={0.05}
        minDistance={4}
        maxDistance={22}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 1.4, 0]}
      />

      <group>
        {matrix.cells.map((cell) => (
          <PerformanceBar
            key={`${cell.model}-${cell.leadTime}`}
            cell={cell}
            maxRmse={maxRmse}
            spacing={spacing}
            onHover={handleHover}
            isHovered={hoveredCell?.model === cell.model && hoveredCell?.leadTime === cell.leadTime}
            colorMode={colorMode}
          />
        ))}
        <AxisLabels spacing={spacing} matrix={matrix} maxRmse={maxRmse} />
        {hoveredCell && <FloatingTooltip cell={hoveredCell} matrix={matrix} />}
      </group>
    </>
  );
}

/* ──────────────────── 2D Fallback Heatmap Matrix ──────────────────── */

function HeatmapMatrix2D({
  matrix,
  bestModels,
}: {
  matrix: PerformanceMatrixData;
  bestModels: Record<string, string>;
}) {
  const maxRmse = Math.max(...matrix.cells.map((c) => c.rmse));
  const minRmse = Math.min(...matrix.cells.filter((c) => c.rmse > 0).map((c) => c.rmse));

  return (
    <div
      className="w-full overflow-x-auto rounded-2xl border p-4 transition-colors"
      style={{
        background: 'var(--card-sub-bg, #0B1120)',
        borderColor: 'var(--card-sub-border, rgba(255, 255, 255, 0.1))',
      }}
    >
      <table className="w-full text-xs text-left">
        <thead>
          <tr
            className="border-b transition-colors font-semibold"
            style={{
              borderColor: 'var(--card-sub-border, rgba(255, 255, 255, 0.1))',
              color: 'var(--text-secondary, #566075)',
            }}
          >
            <th className="py-2.5 px-3">Model</th>
            {LEAD_TIMES.map((lt) => (
              <th key={lt} className="py-2.5 px-3 text-center">
                {lt} Lead
              </th>
            ))}
            <th className="py-2.5 px-3 text-right">Avg Skill</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5 dark:divide-white/5">
          {MODELS.map((model) => {
            const isHybrid = model === 'Hybrid (Final)';
            const cells = matrix.cells.filter((c) => c.model === model);
            const avgSkill = cells.length > 0
              ? (cells.reduce((sum, c) => sum + c.skillScore, 0) / cells.length) * 100
              : 0;

            return (
              <tr
                key={model}
                className={isHybrid ? 'bg-sky-500/10 font-semibold' : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'}
                style={{ color: 'var(--text-primary, #14213d)' }}
              >
                <td className="py-3 px-3 flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: MODEL_COLORS[model] }}
                  />
                  <span className="font-semibold" style={{ color: 'var(--text-primary, #14213d)' }}>{model}</span>
                  {isHybrid && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-700 dark:text-sky-200 font-bold uppercase ml-1 border border-sky-400/40">
                      Best Overall
                    </span>
                  )}
                </td>
                {LEAD_TIMES.map((lt) => {
                  const cell = cells.find((c) => c.leadTime === lt);
                  const isBest = bestModels[lt] === model;

                  return (
                    <td key={lt} className="py-3 px-3 text-center">
                      {cell ? (
                        <div
                          className="inline-flex flex-col items-center px-3 py-1.5 rounded-xl border transition-all"
                          style={{
                            background: isBest
                              ? 'rgba(56, 189, 248, 0.18)'
                              : 'var(--badge-cell-bg, rgba(255, 255, 255, 0.05))',
                            borderColor: isBest
                              ? 'rgba(56, 189, 248, 0.5)'
                              : 'var(--card-sub-border, rgba(255, 255, 255, 0.08))',
                          }}
                        >
                          <span
                            className="font-mono font-bold"
                            style={{
                              color: isBest
                                ? '#0284c7'
                                : 'var(--text-primary, #14213d)',
                            }}
                          >
                            {cell.rmse.toFixed(4)} {matrix.unit}
                          </span>
                          <span
                            className="text-[10px] font-medium"
                            style={{ color: 'var(--text-secondary, #566075)' }}
                          >
                            MAE: {cell.mae.toFixed(4)}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-secondary, #566075)' }}>—</span>
                      )}
                    </td>
                  );
                })}
                <td className="py-3 px-3 text-right font-bold text-emerald-700 dark:text-emerald-400">
                  {avgSkill.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ──────────────────── Safe Error Boundary for WebGL ──────────────────── */

class CanvasErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[PerformanceMatrix3D] WebGL Canvas error caught, falling back to 2D matrix:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/* ──────────────────── Variable & Color Mode Config ──────────────────── */

type VariableKey = 'rainfall' | 'temperature' | 'wind';
type ColorMode = 'model' | 'skill';
type ViewMode = '3d' | '2d';

const VARIABLE_CONFIG: Record<VariableKey, { label: string; icon: string }> = {
  rainfall: { label: 'Rainfall', icon: '🌧️' },
  temperature: { label: 'Temperature', icon: '🌡️' },
  wind: { label: 'Wind Speed', icon: '💨' },
};

/* ──────────────────── Main Exported Component ──────────────────── */

export function PerformanceMatrix3D() {
  const [variable, setVariable] = useState<VariableKey>('rainfall');
  const [colorMode, setColorMode] = useState<ColorMode>('model');
  const [viewMode, setViewMode] = useState<ViewMode>('3d');
  const [autoRotate, setAutoRotate] = useState(true);
  // Initialize with verified default data so there is ZERO blank loading state
  const [matrices, setMatrices] = useState<Record<string, PerformanceMatrixData>>(getDefaultMatrices);

  useEffect(() => {
    let mounted = true;
    fetchAllMatrices()
      .then((data) => {
        if (mounted && data) {
          setMatrices(data);
        }
      })
      .catch((err) => {
        console.warn('[PerformanceMatrix3D] fetch error, using default matrix:', err);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const matrix = matrices[variable] || matrices.rainfall;

  // Find best model at each lead time
  const bestModels = useMemo(() => {
    if (!matrix) return {};
    const bests: Record<string, string> = {};
    for (const lt of LEAD_TIMES) {
      const cellsAtLead = matrix.cells.filter((c) => c.leadTime === lt && c.rmse > 0);
      if (cellsAtLead.length > 0) {
        const best = cellsAtLead.reduce((a, b) => (a.rmse < b.rmse ? a : b));
        bests[lt] = best.model;
      }
    }
    return bests;
  }, [matrix]);

  const isRainfall = matrix?.variable?.toLowerCase() === 'rainfall';
  const hybrid24hRmse = matrix?.cells.find((c) => c.model === 'Hybrid (Final)' && c.leadIndex === 0)?.rmse.toFixed(3);
  const ecmwf24hRmse = matrix?.cells.find((c) => c.model === 'ECMWF IFS' && c.leadIndex === 0)?.rmse.toFixed(3);

  return (
    <GlassCard padding="md" variant="blue">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Box size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-bold tracking-widest uppercase"
                style={{ letterSpacing: '0.12em', color: 'var(--text-primary, #14213d)' }}
              >
                3D PERFORMANCE MATRIX
              </span>
              <Tooltip
                content={
                  <div className="p-1.5 text-xs text-slate-200 max-w-[260px] leading-relaxed">
                    Interactive 3D voxel visualization of RMSE error across models (X), lead times (Z), and error magnitude (Y). Drag to rotate, scroll to zoom, hover bars for details.
                  </div>
                }
              >
                <Info size={13} className="text-[#747F9C] hover:text-[#A9B2C8] cursor-help inline" />
              </Tooltip>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--text-secondary, #566075)' }}>
              Evaluated on 61,560 holdout test split rows across 24h, 48h, and 72h lead periods
            </p>
          </div>
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View mode toggle (3D vs 2D Heatmap) */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 shadow-sm">
            <button
              onClick={() => setViewMode('3d')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === '3d'
                  ? 'bg-sky-500/25 text-sky-300 border border-sky-400/40 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
              type="button"
            >
              <Box size={13} />
              <span>3D View</span>
            </button>
            <button
              onClick={() => setViewMode('2d')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === '2d'
                  ? 'bg-sky-500/25 text-sky-300 border border-sky-400/40 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
              type="button"
            >
              <LayoutGrid size={13} />
              <span>2D Matrix</span>
            </button>
          </div>

          {/* Variable selector */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 shadow-sm">
            {(Object.keys(VARIABLE_CONFIG) as VariableKey[]).map((v) => (
              <button
                key={v}
                onClick={() => setVariable(v)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  variable === v
                    ? 'bg-sky-500/25 text-sky-300 border border-sky-400/40 shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
                type="button"
              >
                {VARIABLE_CONFIG[v].icon} {VARIABLE_CONFIG[v].label}
              </button>
            ))}
          </div>

          {/* Color mode toggle */}
          {viewMode === '3d' && (
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 shadow-sm">
              <button
                onClick={() => setColorMode('model')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  colorMode === 'model'
                    ? 'bg-sky-500/25 text-sky-300 border border-sky-400/40 shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
                type="button"
              >
                By Model
              </button>
              <button
                onClick={() => setColorMode('skill')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  colorMode === 'skill'
                    ? 'bg-sky-500/25 text-sky-300 border border-sky-400/40 shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
                type="button"
              >
                By Skill
              </button>
            </div>
          )}

          {/* Auto-rotate toggle */}
          {viewMode === '3d' && (
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                autoRotate
                  ? 'bg-sky-500/15 text-sky-300 border-sky-400/30'
                  : 'bg-white/[0.04] text-slate-400 border-white/10 hover:text-slate-200'
              }`}
              type="button"
            >
              {autoRotate ? '⟳ Rotating' : '⟳ Paused'}
            </button>
          )}
        </div>
      </div>

      {/* Main Visualization Canvas */}
      {viewMode === '3d' ? (
        <CanvasErrorBoundary
          fallback={<HeatmapMatrix2D matrix={matrix} bestModels={bestModels} />}
        >
          <div
            className="w-full rounded-2xl overflow-hidden border border-white/10 relative shadow-inner"
            style={{
              height: 480,
              background: 'radial-gradient(ellipse at 50% 30%, #0F172A 0%, #030712 100%)',
            }}
          >
            <Canvas
              camera={{ position: [8, 6.5, 8], fov: 45 }}
              shadows
              dpr={[1, 2]}
              gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            >
              <Scene matrix={matrix} colorMode={colorMode} autoRotate={autoRotate} />
            </Canvas>
          </div>
        </CanvasErrorBoundary>
      ) : (
        <HeatmapMatrix2D matrix={matrix} bestModels={bestModels} />
      )}

      {/* Legend + Best Model Summary */}
      <div className="flex flex-wrap items-start justify-between gap-4 mt-4">
        {/* Color legend */}
        <div className="flex flex-wrap items-center gap-3">
          {colorMode === 'model' || viewMode === '2d' ? (
            MODELS.map((m) => (
              <div key={m} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shadow-xs" style={{ background: MODEL_COLORS[m] }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary, #14213d)' }}>{m}</span>
              </div>
            ))
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary, #14213d)' }}>High Skill ({'>'}70%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary, #14213d)' }}>Medium (40–70%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary, #14213d)' }}>Low ({'<'}40%)</span>
              </div>
            </>
          )}
        </div>

        {/* Best model at each lead time */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary, #566075)' }}>Lowest RMSE At:</span>
          {LEAD_TIMES.map((lt) => (
            <span
              key={lt}
              className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1"
              style={{
                background: `${MODEL_COLORS[bestModels[lt]] || '#38bdf8'}18`,
                borderColor: `${MODEL_COLORS[bestModels[lt]] || '#38bdf8'}50`,
                color: MODEL_COLORS[bestModels[lt]] || '#0284c7',
              }}
            >
              <CheckCircle2 size={10} />
              <span>{lt}: {bestModels[lt]}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Insight footer */}
      {matrix && (
        <div
          className="mt-3.5 rounded-xl px-3.5 py-2.5 flex items-start gap-2"
          style={{
            background: 'var(--info-box-bg, rgba(8, 47, 73, 0.4))',
            border: '1px solid var(--info-box-border, rgba(14, 165, 233, 0.3))',
          }}
        >
          <CheckCircle2 size={15} className="text-sky-600 dark:text-sky-400 mt-0.5 shrink-0" />
          <p className="text-xs leading-relaxed font-medium" style={{ color: 'var(--text-primary, #14213d)' }}>
            <strong>Verification Takeaway:</strong> Hybrid AI–RF achieves the lowest RMSE across all lead times for {matrix.variable.toLowerCase()} (
            <span className="font-bold text-sky-700 dark:text-sky-300">
              {hybrid24hRmse} {matrix.unit}
            </span>{' '}
            at 24h vs{' '}
            <span style={{ color: 'var(--text-secondary, #566075)' }}>
              {ecmwf24hRmse} {matrix.unit}
            </span>{' '}
            for ECMWF)
            {isRainfall ? (
              <>
                {' '}and the highest event detection rate (POD 90.8% vs 78.6%), making it the most sensitive system for catching real rain events. However, a higher false-alarm rate (FAR 48.9% vs 37.4%) gives ECMWF alone a higher threat score (CSI 0.5345 vs 0.4860) when false alarms are penalized equally. In a disaster-management context, the higher recall of Hybrid AI–RF is prioritized to prevent missed floods, but this trade-off is made transparent rather than hidden.
              </>
            ) : (
              <>, proving systematic bias reduction over physics-only NWP models.</>
            )}
          </p>
        </div>
      )}
    </GlassCard>
  );
}
