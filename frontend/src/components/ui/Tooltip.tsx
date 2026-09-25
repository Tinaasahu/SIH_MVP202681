'use client';
import { useState, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Tooltip({ content, children, className }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className={cn(
            'absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2',
            'bg-white/90 backdrop-blur-md border border-slate-200/60',
            'rounded-xl shadow-lg px-3 py-2 text-xs text-slate-700',
            'min-w-max max-w-xs animate-in fade-in-0 zoom-in-95 duration-150',
            className
          )}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </div>
  );
}
