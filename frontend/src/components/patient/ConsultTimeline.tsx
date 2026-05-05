import { StatusBadge } from '@/components/shared/StatusBadge';
import type { Consult } from '@/types';
import { format } from 'date-fns';

interface ConsultTimelineProps {
  consults: Consult[];
  onSelect: (consultId: string) => void;
  selectedId?: string;
}

export function ConsultTimeline({ consults, onSelect, selectedId }: ConsultTimelineProps) {
  return (
    <div className="space-y-2">
      {consults.map(c => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors min-h-[44px] ${selectedId === c.id ? 'ring-1 ring-primary' : ''}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {format(new Date(c.startedAt), 'MMM d, yyyy · h:mm a')}
            </span>
            <StatusBadge status={c.status} />
          </div>
        </button>
      ))}
    </div>
  );
}
