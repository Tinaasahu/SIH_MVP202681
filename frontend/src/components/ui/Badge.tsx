import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

const variants = {
  default: 'bg-white/10 text-[#F5F7FF] border-white/15',
  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
  danger: 'bg-rose-500/15 text-rose-300 border-rose-400/30',
  info: 'bg-sky-500/15 text-sky-300 border-sky-400/30',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
