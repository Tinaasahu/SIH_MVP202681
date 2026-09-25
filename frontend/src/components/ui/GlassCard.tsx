import { cn } from '@/lib/utils';
import { HTMLAttributes, forwardRef } from 'react';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ padding = 'md', hover = true, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('glass-card', paddings[padding], className)}
        style={{
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(148,163,184,0.18)',
          boxShadow: '0 4px 32px rgba(15,23,42,0.06)',
          borderRadius: '20px',
          transition: hover ? 'all 0.25s cubic-bezier(0.16,1,0.3,1)' : undefined,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = 'GlassCard';
