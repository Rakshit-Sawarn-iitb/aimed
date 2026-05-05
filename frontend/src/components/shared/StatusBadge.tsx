import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import type { ConsultStatus } from '@/types';

const statusConfig: Record<ConsultStatus, { icon: React.ElementType; label: string; className: string }> = {
  recording: { icon: Circle, label: 'Recording', className: 'text-danger' },
  uploaded: { icon: Loader2, label: 'Uploaded', className: 'text-muted-foreground' },
  transcribing: { icon: Loader2, label: 'Transcribing', className: 'text-muted-foreground' },
  extracting: { icon: Loader2, label: 'Extracting', className: 'text-muted-foreground' },
  in_review: { icon: Circle, label: 'In review', className: 'text-warning' },
  finalized: { icon: CheckCircle2, label: 'Finalized', className: 'text-success' },
  failed: { icon: XCircle, label: 'Failed', className: 'text-danger' },
};

interface StatusBadgeProps {
  status: ConsultStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const isSpinner = status === 'uploaded' || status === 'transcribing' || status === 'extracting';

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px] font-medium', config.className, className)}>
      <Icon className={cn('h-3.5 w-3.5', isSpinner && 'animate-spin', status === 'recording' && 'fill-current animate-pulse-dot')} />
      {config.label}
    </span>
  );
}
