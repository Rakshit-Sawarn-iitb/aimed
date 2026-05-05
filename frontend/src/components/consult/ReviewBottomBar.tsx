import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReviewBottomBarProps {
  reviewedCount: number;
  totalCount: number;
  allReviewed: boolean;
  isApproving?: boolean;
  onFreeze: () => void;
}

export function ReviewBottomBar({ reviewedCount, totalCount, allReviewed, isApproving = false, onFreeze }: ReviewBottomBarProps) {
  return (
    <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-between shrink-0">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{reviewedCount}</span> of {totalCount} facts reviewed
      </p>
      <Button
        disabled={!allReviewed || isApproving}
        onClick={onFreeze}
        className="min-h-[44px] gap-2"
        title={!allReviewed ? `${totalCount - reviewedCount} facts still need review` : undefined}
      >
        {isApproving && <Loader2 className="h-4 w-4 animate-spin" />}
        Approve &amp; Finalize
      </Button>
    </div>
  );
}
