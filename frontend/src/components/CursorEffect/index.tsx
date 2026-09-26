'use client';
import { useEffect, useRef } from 'react';

export function CursorEffect() {
  const containerRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const lightningRingRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Disable on reduced motion preference or touch devices
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      window.matchMedia('(pointer: coarse)').matches
    ) {
      return;
    }

    let mouseX = -200, mouseY = -200;
    let trailX = -200, trailY = -200;
    let glowX = -200, glowY = -200;
    let isInitialized = false;
    let isPointer = false;
    let raf: number;

    const dotEl = dotRef.current;
    const ringEl = lightningRingRef.current;
    const glowEl = glowRef.current;
    const containerEl = containerRef.current;

    // Zero-overhead direct pinpoint update on mouse movement
    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (!isInitialized) {
        isInitialized = true;
        trailX = mouseX;
        trailY = mouseY;
        glowX = mouseX;
        glowY = mouseY;
        if (containerEl) containerEl.style.opacity = '1';
      }

      // Instantaneous hardware-accelerated transform for pinpoint core
      if (dotEl) {
        dotEl.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate3d(-50%, -50%, 0) scale(${isPointer ? 1.35 : 1})`;
      }
    };

    // Hover state checked only on element boundary crossings (mouseover)
    // Avoids running DOM traversal on every single mousemove pixel
    const onOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const clickable = !!target?.closest('button, a, input, select, textarea, [role="button"], .cursor-pointer, [data-clickable]');
      if (clickable !== isPointer) {
        isPointer = clickable;
        if (dotEl) {
          dotEl.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate3d(-50%, -50%, 0) scale(${isPointer ? 1.35 : 1})`;
          dotEl.style.backgroundColor = isPointer ? '#38bdf8' : '#0284c7';
        }
      }
    };

    const onLeave = () => {
      if (containerEl) containerEl.style.opacity = '0';
    };

    const onEnter = () => {
      if (containerEl && isInitialized) containerEl.style.opacity = '1';
    };

    // Ultra-snappy 60/120/144 FPS animation loop for plasma ring and glow
    const animate = () => {
      // Snappy response: 0.68 closes ~96% of gap in 3 frames (~30ms) vs 250ms+ at 0.22
      trailX += (mouseX - trailX) * 0.68;
      trailY += (mouseY - trailY) * 0.68;
      glowX += (mouseX - glowX) * 0.32;
      glowY += (mouseY - glowY) * 0.32;

      if (ringEl) {
        ringEl.style.transform = `translate3d(${trailX}px, ${trailY}px, 0) translate3d(-50%, -50%, 0) scale(${isPointer ? 1.32 : 1})`;
      }
      if (glowEl) {
        glowEl.style.transform = `translate3d(${glowX}px, ${glowY}px, 0) translate3d(-50%, -50%, 0)`;
      }

      raf = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseover', onOver, { passive: true });
    document.addEventListener('mouseleave', onLeave, { passive: true });
    document.addEventListener('mouseenter', onEnter, { passive: true });
    raf = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseenter', onEnter);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-[99999] overflow-hidden"
      style={{ opacity: 0, transition: 'opacity 0.15s ease' }}
      aria-hidden="true"
    >
      {/* Diffuse electric atmospheric aura */}
      <div
        ref={glowRef}
        className="pointer-events-none fixed top-0 left-0 z-[99996] rounded-full"
        style={{
          width: 280,
          height: 280,
          background: 'radial-gradient(circle, rgba(14, 165, 233, 0.08) 0%, rgba(59, 130, 246, 0.04) 40%, transparent 70%)',
          willChange: 'transform',
        }}
      />

      {/* Under-Lightning Plasma Aura Ring */}
      <div
        ref={lightningRingRef}
        className="pointer-events-none fixed top-0 left-0 z-[99997]"
        style={{
          width: 38,
          height: 38,
          willChange: 'transform',
        }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full animate-spin"
          style={{ animationDuration: '4s' }}
        >
          {/* Outer crackling electric arc */}
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="rgba(56, 189, 248, 0.5)"
            strokeWidth="2.5"
            strokeDasharray="18 12 8 16"
            className="opacity-75"
          />
          {/* Inner counter-rotating lightning filament */}
          <circle
            cx="50"
            cy="50"
            r="36"
            fill="none"
            stroke="rgba(14, 165, 233, 0.65)"
            strokeWidth="1.5"
            strokeDasharray="25 20 15 10"
            className="opacity-90"
          />
          {/* Micro lightning spark node */}
          <path
            d="M50 18 L53 38 L47 42 L52 64 L44 54"
            fill="none"
            stroke="rgba(186, 230, 253, 0.85)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Sharp Electric Pinpoint Cursor Core */}
      <div
        ref={dotRef}
        className="pointer-events-none fixed top-0 left-0 z-[99999]"
        style={{
          width: 6,
          height: 6,
          backgroundColor: '#0284c7',
          borderRadius: '50%',
          boxShadow: '0 0 10px 2px rgba(56, 189, 248, 0.95), 0 0 18px 4px rgba(14, 165, 233, 0.6)',
          transition: 'background-color 0.15s ease',
          willChange: 'transform',
        }}
      />
    </div>
  );
}

