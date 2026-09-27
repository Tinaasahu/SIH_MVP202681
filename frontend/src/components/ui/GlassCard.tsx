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
    background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.88) 0%, rgba(248, 250, 252, 0.74) 100%)',
    border: '1px solid rgba(226, 232, 240, 0.85)',
    boxShadow: '0 8px 32px -4px rgba(15, 23, 42, 0.05), inset 0 1px 1px 0 rgba(255, 255, 255, 0.95)',
  },
  blue: {
    background: 'linear-gradient(145deg, rgba(240, 249, 255, 0.92) 0%, rgba(224, 242, 254, 0.78) 100%)',
    border: '1px solid rgba(186, 230, 253, 0.85)',
    boxShadow: '0 10px 32px -4px rgba(2, 132, 199, 0.09), inset 0 1px 1px 0 rgba(255, 255, 255, 0.95)',
  },
  orange: {
    background: 'linear-gradient(145deg, rgba(255, 247, 237, 0.92) 0%, rgba(254, 237, 213, 0.78) 100%)',
    border: '1px solid rgba(254, 215, 170, 0.85)',
    boxShadow: '0 10px 32px -4px rgba(234, 88, 12, 0.09), inset 0 1px 1px 0 rgba(255, 255, 255, 0.95)',
  },
  red: {
    background: 'linear-gradient(145deg, rgba(254, 242, 242, 0.92) 0%, rgba(254, 226, 226, 0.78) 100%)',
    border: '1px solid rgba(254, 202, 202, 0.85)',
    boxShadow: '0 10px 32px -4px rgba(220, 38, 38, 0.09), inset 0 1px 1px 0 rgba(255, 255, 255, 0.95)',
  },
  yellow: {
    background: 'linear-gradient(145deg, rgba(254, 252, 232, 0.92) 0%, rgba(254, 249, 195, 0.78) 100%)',
    border: '1px solid rgba(253, 224, 71, 0.85)',
    boxShadow: '0 10px 32px -4px rgba(202, 138, 4, 0.09), inset 0 1px 1px 0 rgba(255, 255, 255, 0.95)',
  },
  green: {
    background: 'linear-gradient(145deg, rgba(240, 253, 244, 0.92) 0%, rgba(220, 252, 231, 0.78) 100%)',
    border: '1px solid rgba(187, 247, 208, 0.85)',
    boxShadow: '0 10px 32px -4px rgba(16, 185, 129, 0.09), inset 0 1px 1px 0 rgba(255, 255, 255, 0.95)',
  },
  grey: {
    background: 'linear-gradient(145deg, rgba(248, 250, 252, 0.94) 0%, rgba(241, 245, 249, 0.85) 100%)',
    border: '1px solid rgba(203, 213, 225, 0.85)',
    boxShadow: '0 10px 32px -4px rgba(71, 85, 105, 0.07), inset 0 1px 1px 0 rgba(255, 255, 255, 0.95)',
  },
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ padding = 'md', hover = true, variant = 'default', className, style, children, ...props }, ref) => {
    const vStyle = variantStyles[variant] || variantStyles.default;
    return (
      <div
        ref={ref}
        className={cn('glass-card', paddings[padding], className)}
        style={{
          background: vStyle.background,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: vStyle.border,
          boxShadow: vStyle.boxShadow,
          borderRadius: '20px',
          transition: hover ? 'all 0.25s cubic-bezier(0.16,1,0.3,1)' : undefined,
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

