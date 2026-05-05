import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ReviewBottomBarProps {
  reviewedCount: number;
  totalCount: number;
  allReviewed: boolean;
  onFreeze: () => void;
}

export function ReviewBottomBar({ reviewedCount, totalCount, allReviewed, onFreeze }: ReviewBottomBarProps) {
  return (
    <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-between shrink-0">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{reviewedCount}</span> of {totalCount} facts reviewed
      </p>
      <Button
        disabled={!allReviewed}
        onClick={onFreeze}
        className="min-h-[44px]"
        title={!allReviewed ? `${totalCount - reviewedCount} facts still need review` : undefined}
      >
        Freeze record
      </Button>
    </div>
  );
}
