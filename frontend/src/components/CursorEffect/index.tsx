'use client';
import { useEffect, useRef, useState } from 'react';

export function CursorEffect() {
  const dotRef = useRef<HTMLDivElement>(null);
  const lightningRingRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [isPointer, setIsPointer] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;

    let mouseX = -100, mouseY = -100;
    let trailX = -100, trailY = -100;
    let glowX = -100, glowY = -100;
    let raf: number;

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
      }

      // Check if hovering over clickable element
      const target = e.target as HTMLElement | null;
      if (target) {
        const isClickable = target.closest('button, a, input, select, [role="button"], .cursor-pointer');
        setIsPointer(!!isClickable);
      }
    };

    const animate = () => {
      // Trail effect with electric spring dynamics
      trailX += (mouseX - trailX) * 0.22;
      trailY += (mouseY - trailY) * 0.22;
      glowX += (mouseX - glowX) * 0.08;
      glowY += (mouseY - glowY) * 0.08;

      if (lightningRingRef.current) {
        lightningRingRef.current.style.transform = `translate(${trailX}px, ${trailY}px) translate(-50%, -50%)`;
      }
      if (glowRef.current) {
        glowRef.current.style.transform = `translate(${glowX}px, ${glowY}px) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', onMove);
    raf = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      {/* Diffuse electric atmospheric aura */}
      <div
        ref={glowRef}
        className="pointer-events-none fixed top-0 left-0 z-[99996] rounded-full"
        style={{
          width: 320,
          height: 320,
          background: 'radial-gradient(circle, rgba(14, 165, 233, 0.08) 0%, rgba(59, 130, 246, 0.04) 40%, transparent 70%)',
          willChange: 'transform',
        }}
        aria-hidden="true"
      />

      {/* Under-Lightning Plasma Aura Ring */}
      <div
        ref={lightningRingRef}
        className="pointer-events-none fixed top-0 left-0 z-[99997]"
        style={{
          width: isPointer ? 48 : 36,
          height: isPointer ? 48 : 36,
          transition: 'width 0.2s ease, height 0.2s ease',
          willChange: 'transform',
        }}
        aria-hidden="true"
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
            stroke="rgba(56, 189, 248, 0.45)"
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
            stroke="rgba(14, 165, 233, 0.6)"
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
          width: isPointer ? 8 : 6,
          height: isPointer ? 8 : 6,
          backgroundColor: '#0284c7',
          borderRadius: '50%',
          boxShadow: '0 0 10px 2px rgba(56, 189, 248, 0.9), 0 0 18px 4px rgba(14, 165, 233, 0.5)',
          transition: 'width 0.15s ease, height 0.15s ease, background-color 0.15s ease',
          willChange: 'transform',
        }}
        aria-hidden="true"
      />
    </>
  );
}
