import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'glass';
  size?: 'sm' | 'md' | 'lg';
}

const variants = {
  primary: 'bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/20 border border-sky-400/40',
  secondary: 'bg-[rgba(14,27,68,0.75)] hover:bg-[rgba(20,38,96,0.85)] text-[#F5F7FF] border border-white/15 shadow-sm',
  ghost: 'hover:bg-white/10 text-[#AAB7D4] hover:text-[#F5F7FF]',
  glass: 'bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 text-[#F5F7FF] shadow-sm',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-xl',
  lg: 'px-5 py-2.5 text-sm rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center gap-2 font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
