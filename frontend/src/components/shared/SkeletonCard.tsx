import { cn } from '@/lib/utils';

interface SkeletonCardProps {
  lines?: number;
  className?: string;
}

export function SkeletonCard({ lines = 3, className }: SkeletonCardProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4 space-y-3', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-4 rounded bg-muted animate-pulse',
            i === 0 && 'w-1/3',
            i === 1 && 'w-full',
            i >= 2 && 'w-2/3'
          )}
        />
      ))}
    </div>
  );
}
