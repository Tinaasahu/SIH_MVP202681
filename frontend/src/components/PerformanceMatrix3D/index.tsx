'use client';
import { useRef, useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Text, Html, Environment, Float } from '@react-three/drei';
import * as THREE from 'three';
import {
  fetchAllMatrices,
  MODELS,
  LEAD_TIMES,
  MODEL_COLORS,
  PerformanceCell,
  PerformanceMatrixData,
} from '@/data/performanceMatrixData';
import { GlassCard } from '@/components/ui/GlassCard';
import { Tooltip } from '@/components/ui/Tooltip';
import { Info, Box, BarChart3 } from 'lucide-react';

/* ──────────────────── Color helpers ──────────────────── */

function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bv = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bv})`;
}

function getBarColor(skill: number): string {
  if (skill > 0.7) return '#10b981'; // emerald
  if (skill > 0.4) return '#f59e0b'; // amber
  return '#ef4444'; // red
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
  const normalizedHeight = Math.max(0.15, (cell.rmse / (maxRmse || 1)) * 4); // max height = 4 units
  const targetHeight = useRef(normalizedHeight);
  const currentHeight = useRef(normalizedHeight);

  targetHeight.current = normalizedHeight;

  const baseColor = colorMode === 'model'
    ? MODEL_COLORS[cell.model] || '#6366f1'
    : getBarColor(cell.skillScore);

  useFrame((_state, delta) => {
    if (!meshRef.current) return;

    // Smooth animation
    currentHeight.current += (targetHeight.current - currentHeight.current) * Math.min(delta * 4, 1);
    const h = Math.max(0.05, currentHeight.current);
    meshRef.current.scale.y = h;
    meshRef.current.position.y = h / 2;

    // Hover glow
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    if (mat) {
      const targetEmissive = isHovered ? 0.4 : 0;
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
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(cell); }}
      onPointerOut={() => onHover(null)}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[spacing * 0.7, 1, spacing * 0.7]} />
      <meshStandardMaterial
        color={baseColor}
        transparent
        opacity={isHovered ? 1 : 0.88}
        emissive={baseColor}
        emissiveIntensity={0}
        roughness={0.3}
        metalness={0.15}
      />
    </mesh>
  );
}

/* ──────────────────── Grid / Axes ──────────────────── */

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
        <Text
          key={`model-${i}`}
          position={[xStart + i * spacing, -0.3, ((LEAD_TIMES.length - 1) * spacing) / 2 + 1.2]}
          fontSize={0.22}
          color="#475569"
          anchorX="center"
          anchorY="middle"
          rotation={[-Math.PI / 2, 0, -Math.PI / 6]}
        >
          {model}
        </Text>
      ))}

      {/* Lead Time labels along Z axis */}
      {LEAD_TIMES.map((lt, i) => (
        <Text
          key={`lead-${i}`}
          position={[-((MODELS.length - 1) * spacing) / 2 - 1.2, -0.3, zStart + i * spacing]}
          fontSize={0.24}
          color="#475569"
          anchorX="center"
          anchorY="middle"
          rotation={[-Math.PI / 2, 0, 0]}
        >
          {lt}
        </Text>
      ))}

      {/* Y axis ticks */}
      {[0, 1, 2, 3, 4].map(tick => {
        const rmseVal = ((tick / 4) * maxRmse).toFixed(1);
        return (
          <group key={`ytick-${tick}`}>
            <Text
              position={[-((MODELS.length - 1) * spacing) / 2 - 1.5, tick, 0]}
              fontSize={0.2}
              color="#94a3b8"
              anchorX="right"
              anchorY="middle"
            >
              {rmseVal}
            </Text>
            {/* Horizontal grid line */}
            <mesh position={[0, tick, 0]}>
              <planeGeometry args={[(MODELS.length - 1) * spacing + 2, (LEAD_TIMES.length - 1) * spacing + 2]} />
              <meshBasicMaterial
                color="#e2e8f0"
                transparent
                opacity={0.12}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        );
      })}

      {/* Axis titles */}
      <Text
        position={[0, -0.3, ((LEAD_TIMES.length - 1) * spacing) / 2 + 2.2]}
        fontSize={0.28}
        color="#1e293b"
        anchorX="center"
        fontWeight="bold"
        rotation={[-Math.PI / 2, 0, 0]}
      >
        Models →
      </Text>
      <Text
        position={[-((MODELS.length - 1) * spacing) / 2 - 2.5, -0.3, 0]}
        fontSize={0.28}
        color="#1e293b"
        anchorX="center"
        fontWeight="bold"
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
      >
        Lead Time →
      </Text>
      <Text
        position={[-((MODELS.length - 1) * spacing) / 2 - 2.5, 2, -((LEAD_TIMES.length - 1) * spacing) / 2 - 0.5]}
        fontSize={0.24}
        color="#1e293b"
        anchorX="center"
        rotation={[0, Math.PI / 4, Math.PI / 2]}
      >
        {`RMSE (${matrix.unit}) ↑`}
      </Text>

      {/* Base grid */}
      <gridHelper
        args={[
          Math.max((MODELS.length - 1) * spacing, (LEAD_TIMES.length - 1) * spacing) + 2,
          10,
          '#cbd5e1',
          '#e2e8f0',
        ]}
        position={[0, -0.01, 0]}
      />
    </group>
  );
}

/* ──────────────────── Floating Tooltip inside Canvas ──────────────────── */

function FloatingTooltip({ cell, matrix }: { cell: PerformanceCell; matrix: PerformanceMatrixData }) {
  const spacing = 1.5;
  const x = cell.modelIndex * spacing - ((MODELS.length - 1) * spacing) / 2;
  const z = cell.leadIndex * spacing - ((LEAD_TIMES.length - 1) * spacing) / 2;
  const maxRmse = Math.max(...matrix.cells.map(c => c.rmse));
  const y = (cell.rmse / maxRmse) * 4 + 0.6;

  return (
    <Html
      position={[x, y, z]}
      center
      distanceFactor={8}
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="px-3 py-2.5 rounded-xl shadow-xl border text-xs whitespace-nowrap"
        style={{
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(12px)',
          borderColor: 'rgba(148,163,184,0.25)',
          minWidth: 160,
        }}
      >
        <div className="font-bold text-slate-800 mb-1">{cell.model}</div>
        <div className="text-slate-500 mb-1.5">Lead: {cell.leadTime} · {matrix.variable}</div>
        <div className="space-y-0.5">
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">RMSE</span>
            <span className="font-bold text-slate-800">{cell.rmse} {matrix.unit}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">MAE</span>
            <span className="font-semibold text-slate-700">{cell.mae} {matrix.unit}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Bias</span>
            <span className={`font-semibold ${cell.bias >= 0 ? 'text-amber-600' : 'text-blue-600'}`}>
              {cell.bias > 0 ? '+' : ''}{cell.bias} {matrix.unit}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Skill</span>
            <span className="font-bold text-emerald-600">{(cell.skillScore * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>
    </Html>
  );
}

/* ──────────────────── Scene ──────────────────── */

interface SceneProps {
  matrix: PerformanceMatrixData;
  colorMode: 'model' | 'skill';
  autoRotate: boolean;
}

function Scene({ matrix, colorMode, autoRotate }: SceneProps) {
  const [hoveredCell, setHoveredCell] = useState<PerformanceCell | null>(null);
  const spacing = 1.5;
  const maxRmse = useMemo(() => Math.max(...matrix.cells.map(c => c.rmse)), [matrix]);

  const handleHover = useCallback((cell: PerformanceCell | null) => {
    setHoveredCell(cell);
  }, []);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 5]} intensity={1} castShadow />
      <directionalLight position={[-3, 6, -3]} intensity={0.3} />
      <pointLight position={[0, 6, 0]} intensity={0.4} color="#60a5fa" />

      <OrbitControls
        autoRotate={autoRotate}
        autoRotateSpeed={0.5}
        enablePan={true}
        enableZoom={true}
        enableDamping={true}
        dampingFactor={0.05}
        minDistance={4}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 1.5, 0]}
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

/* ──────────────────── Variable & Color Mode Selector ──────────────────── */

type VariableKey = 'rainfall' | 'temperature' | 'wind';
type ColorMode = 'model' | 'skill';

const VARIABLE_CONFIG: Record<VariableKey, { label: string; icon: string }> = {
  rainfall: { label: 'Rainfall', icon: '🌧️' },
  temperature: { label: 'Temperature', icon: '🌡️' },
  wind: { label: 'Wind Speed', icon: '💨' },
};

/* ──────────────────── Main Exported Component ──────────────────── */

export function PerformanceMatrix3D() {
  const [variable, setVariable] = useState<VariableKey>('rainfall');
  const [colorMode, setColorMode] = useState<ColorMode>('model');
  const [autoRotate, setAutoRotate] = useState(true);
  const [matrices, setMatrices] = useState<Record<string, PerformanceMatrixData> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchAllMatrices()
      .then((data) => {
        if (mounted) {
          if (data && Object.keys(data).length > 0) {
            setMatrices(data);
            setIsError(false);
          } else {
            setIsError(true);
          }
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsError(true);
          setIsLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const matrix = matrices ? matrices[variable] : null;

  // Find best model at each lead time
  const bestModels = useMemo(() => {
    if (!matrix) return {};
    const bests: Record<string, string> = {};
    for (const lt of LEAD_TIMES) {
      const cellsAtLead = matrix.cells.filter(c => c.leadTime === lt);
      if (cellsAtLead.length > 0) {
        const best = cellsAtLead.reduce((a, b) => (a.rmse < b.rmse ? a : b));
        bests[lt] = best.model;
      }
    }
    return bests;
  }, [matrix]);

  if (isLoading) {
    return (
      <GlassCard padding="md">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 flex items-center justify-center text-blue-600">
            <Box size={15} />
          </div>
          <span className="text-xs font-bold tracking-widest text-slate-700 uppercase" style={{ letterSpacing: '0.12em' }}>
            3D PERFORMANCE MATRIX
          </span>
        </div>
        <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
          Loading performance validation matrix...
        </div>
      </GlassCard>
    );
  }

  if (isError || !matrix) {
    return (
      <GlassCard padding="md">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 flex items-center justify-center text-blue-600">
            <Box size={15} />
          </div>
          <span className="text-xs font-bold tracking-widest text-slate-700 uppercase" style={{ letterSpacing: '0.12em' }}>
            3D PERFORMANCE MATRIX
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            Unavailable
          </span>
        </div>
        <div className="h-64 flex items-center justify-center text-slate-500 text-xs">
          3D Performance Matrix unavailable. Could not fetch metrics from /api/performance.
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding="md">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 flex items-center justify-center text-blue-600">
            <Box size={15} />
          </div>
          <div>
            <span className="text-xs font-bold tracking-widest text-slate-700 uppercase" style={{ letterSpacing: '0.12em' }}>
              3D PERFORMANCE MATRIX
            </span>
            <Tooltip content={
              <div className="p-1.5 text-xs text-slate-700 max-w-[240px]">
                Interactive 3D visualization of RMSE error across models (X), lead times (Z), and error magnitude (Y). Drag to rotate, scroll to zoom. Hover bars for details.
              </div>
            }>
              <Info size={13} className="text-slate-400 cursor-help ml-1.5 inline" />
            </Tooltip>
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2">
          {/* Variable selector */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/80 border border-slate-200/80 shadow-2xs">
            {(Object.keys(VARIABLE_CONFIG) as VariableKey[]).map((v) => (
              <button
                key={v}
                onClick={() => setVariable(v)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  variable === v
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
                }`}
                type="button"
              >
                {VARIABLE_CONFIG[v].icon} {VARIABLE_CONFIG[v].label}
              </button>
            ))}
          </div>

          {/* Color mode toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/80 border border-slate-200/80 shadow-2xs">
            <button
              onClick={() => setColorMode('model')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                colorMode === 'model'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
              }`}
              type="button"
            >
              By Model
            </button>
            <button
              onClick={() => setColorMode('skill')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                colorMode === 'skill'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
              }`}
              type="button"
            >
              By Skill
            </button>
          </div>

          {/* Auto-rotate toggle */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
              autoRotate
                ? 'bg-blue-50 text-blue-600 border-blue-200'
                : 'bg-white text-slate-500 border-slate-200 hover:text-slate-700'
            }`}
            type="button"
          >
            {autoRotate ? '⟳ Rotating' : '⟳ Paused'}
          </button>
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="w-full rounded-2xl overflow-hidden border border-slate-200/60" style={{ height: 480, background: 'linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)' }}>
        <Canvas
          camera={{ position: [8, 6, 8], fov: 45 }}
          shadows
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
        >
          <Suspense fallback={null}>
            <Scene matrix={matrix} colorMode={colorMode} autoRotate={autoRotate} />
          </Suspense>
        </Canvas>
      </div>

      {/* Legend + Best Model Summary */}
      <div className="flex flex-wrap items-start justify-between gap-4 mt-4">
        {/* Color legend */}
        <div className="flex flex-wrap items-center gap-3">
          {colorMode === 'model' ? (
            MODELS.map(m => (
              <div key={m} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shadow-2xs"
                  style={{ background: MODEL_COLORS[m] }}
                />
                <span className="text-xs text-slate-600">{m}</span>
              </div>
            ))
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-slate-600">High Skill ({'>'}70%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-xs text-slate-600">Medium (40–70%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-xs text-slate-600">Low ({'<'}40%)</span>
              </div>
            </>
          )}
        </div>

        {/* Best model at each lead time */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Best at:</span>
          {LEAD_TIMES.map(lt => (
            <span
              key={lt}
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
              style={{
                background: `${MODEL_COLORS[bestModels[lt]]}12`,
                borderColor: `${MODEL_COLORS[bestModels[lt]]}30`,
                color: MODEL_COLORS[bestModels[lt]],
              }}
            >
              {lt}: {bestModels[lt]}
            </span>
          ))}
        </div>
      </div>

      {/* Insight footer */}
      {matrix && (
        <div
          className="mt-3 rounded-xl px-3.5 py-2.5"
          style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}
        >
          <p className="text-xs text-slate-600 leading-relaxed">
            <span className="font-bold text-emerald-700">Hybrid (Final)</span> achieves lowest RMSE across lead times for {matrix.variable.toLowerCase()} (
            {matrix.cells.find(c => c.model === 'Hybrid (Final)' && c.leadIndex === 0)?.rmse} {matrix.unit} at 24h vs{' '}
            {matrix.cells.find(c => c.model === 'ECMWF IFS' && c.leadIndex === 0)?.rmse} {matrix.unit} for ECMWF IFS).
          </p>
        </div>
      )}
    </GlassCard>
  );
}
