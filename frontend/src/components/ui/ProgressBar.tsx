import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  animated?: boolean;
  className?: string;
  label?: string;
}

export function ProgressBar({ value, max = 100, color = '#3b82f6', height = 6, animated = true, className, label }: ProgressBarProps) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-slate-500">{label}</span>
          <span className="text-xs font-semibold text-slate-700">{value}%</span>
        </div>
      )}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height, background: 'rgba(148,163,184,0.15)' }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: color,
            transition: animated ? 'width 0.8s cubic-bezier(0.16,1,0.3,1)' : undefined,
          }}
        />
      </div>
    </div>
  );
}
