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
    background: 'rgba(8, 13, 32, 0.58)',
    border: '1px solid rgba(220, 225, 255, 0.14)',
    boxShadow: '0 16px 45px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  },
  blue: {
    background: 'rgba(9, 15, 36, 0.58)',
    border: '1px solid rgba(220, 225, 255, 0.14)',
    boxShadow: '0 16px 45px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  },
  orange: {
    background: 'rgba(16, 14, 28, 0.58)',
    border: '1px solid rgba(255, 230, 190, 0.14)',
    boxShadow: '0 16px 45px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 230, 190, 0.06)',
  },
  red: {
    background: 'rgba(20, 12, 22, 0.58)',
    border: '1px solid rgba(248, 113, 113, 0.16)',
    boxShadow: '0 16px 45px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  },
  yellow: {
    background: 'rgba(16, 15, 28, 0.58)',
    border: '1px solid rgba(255, 230, 190, 0.14)',
    boxShadow: '0 16px 45px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 230, 190, 0.06)',
  },
  green: {
    background: 'rgba(10, 16, 30, 0.58)',
    border: '1px solid rgba(220, 225, 255, 0.14)',
    boxShadow: '0 16px 45px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  },
  grey: {
    background: 'rgba(8, 13, 32, 0.58)',
    border: '1px solid rgba(220, 225, 255, 0.14)',
    boxShadow: '0 16px 45px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  },
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ padding = 'md', hover = true, variant = 'default', className, style, children, ...props }, ref) => {
    const vStyle = variantStyles[variant] || variantStyles.default;
    return (
      <div
        ref={ref}
        className={cn('glass-card text-[#F3F5FA]', paddings[padding], className)}
        style={{
          background: vStyle.background,
          backdropFilter: 'blur(22px) saturate(115%)',
          WebkitBackdropFilter: 'blur(22px) saturate(115%)',
          border: vStyle.border,
          boxShadow: vStyle.boxShadow,
          borderRadius: '20px',
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

