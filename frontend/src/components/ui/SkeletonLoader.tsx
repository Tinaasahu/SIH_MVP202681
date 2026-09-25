import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  lines?: number;
}

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn('skeleton', className)} style={style} />;
}

export function SkeletonCard({ lines = 3 }: SkeletonProps) {
  return (
    <div className="glass-card p-6 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-32" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-2" style={{ width: `${60 + Math.random() * 35}%` } as React.CSSProperties} />
      ))}
    </div>
  );
}
