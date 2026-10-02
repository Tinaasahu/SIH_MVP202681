import { cn } from '@/lib/utils';
import { HTMLAttributes, forwardRef } from 'react';

export type CardColorVariant = 'default' | 'blue' | 'orange' | 'red' | 'yellow' | 'green' | 'grey';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  variant?: CardColorVariant;
}

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const variantStyles: Record<CardColorVariant, { background: string; border: string; boxShadow: string }> = {
  default: {
    background: 'linear-gradient(145deg, rgba(14, 27, 68, 0.58) 0%, rgba(8, 17, 44, 0.65) 100%)',
    border: '1px solid rgba(255, 255, 255, 0.16)',
    boxShadow: '0 16px 36px -6px rgba(0, 4, 18, 0.55), inset 0 1px 1px 0 rgba(255, 255, 255, 0.18)',
  },
  blue: {
    background: 'linear-gradient(145deg, rgba(16, 34, 82, 0.62) 0%, rgba(10, 20, 52, 0.68) 100%)',
    border: '1px solid rgba(56, 189, 248, 0.22)',
    boxShadow: '0 16px 36px -6px rgba(0, 4, 18, 0.55), inset 0 1px 1px 0 rgba(147, 197, 253, 0.22)',
  },
  orange: {
    background: 'linear-gradient(145deg, rgba(38, 26, 48, 0.60) 0%, rgba(16, 20, 44, 0.68) 100%)',
    border: '1px solid rgba(245, 158, 11, 0.22)',
    boxShadow: '0 16px 36px -6px rgba(0, 4, 18, 0.55), inset 0 1px 1px 0 rgba(253, 230, 138, 0.18)',
  },
  red: {
    background: 'linear-gradient(145deg, rgba(42, 20, 44, 0.60) 0%, rgba(18, 16, 42, 0.68) 100%)',
    border: '1px solid rgba(239, 68, 68, 0.22)',
    boxShadow: '0 16px 36px -6px rgba(0, 4, 18, 0.55), inset 0 1px 1px 0 rgba(254, 202, 202, 0.18)',
  },
  yellow: {
    background: 'linear-gradient(145deg, rgba(28, 28, 56, 0.62) 0%, rgba(14, 18, 44, 0.68) 100%)',
    border: '1px solid rgba(250, 204, 21, 0.22)',
    boxShadow: '0 16px 36px -6px rgba(0, 4, 18, 0.55), inset 0 1px 1px 0 rgba(254, 240, 138, 0.18)',
  },
  green: {
    background: 'linear-gradient(145deg, rgba(14, 34, 56, 0.62) 0%, rgba(8, 22, 42, 0.68) 100%)',
    border: '1px solid rgba(16, 185, 129, 0.22)',
    boxShadow: '0 16px 36px -6px rgba(0, 4, 18, 0.55), inset 0 1px 1px 0 rgba(167, 243, 208, 0.18)',
  },
  grey: {
    background: 'linear-gradient(145deg, rgba(16, 24, 52, 0.58) 0%, rgba(9, 14, 38, 0.66) 100%)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    boxShadow: '0 16px 36px -6px rgba(0, 4, 18, 0.55), inset 0 1px 1px 0 rgba(255, 255, 255, 0.16)',
  },
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ padding = 'md', hover = true, variant = 'default', className, style, children, ...props }, ref) => {
    const vStyle = variantStyles[variant] || variantStyles.default;
    return (
      <div
        ref={ref}
        className={cn('glass-card text-[#F5F7FF]', paddings[padding], className)}
        style={{
          background: vStyle.background,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: vStyle.border,
          boxShadow: vStyle.boxShadow,
          borderRadius: '22px',
          transition: hover ? 'all 0.28s cubic-bezier(0.16,1,0.3,1)' : undefined,
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = 'GlassCard';

