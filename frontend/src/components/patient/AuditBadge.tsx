import { CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Fact } from '@/types';

interface AuditBadgeProps {
  facts: Fact[];
}

export function AuditBadge({ facts }: AuditBadgeProps) {
  const highRisk = facts.filter(f => f.riskTier === 3);
  const individuallyReviewed = highRisk.filter(f => f.individuallyReviewed);
  const bulkApproved = highRisk.filter(f => !f.individuallyReviewed && f.status === 'approved');
  const audioPlayed = highRisk.filter(f => f.audioPlayed);

  if (highRisk.length === 0) return null;

  const allIndividual = bulkApproved.length === 0;

  if (allIndividual) {
    return (
      <div className="flex items-center gap-1.5 text-success text-xs mt-1">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>Individually reviewed all {highRisk.length} high-risk items · Audio played for {audioPlayed.length}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-warning text-xs mt-1">
      <AlertTriangle className="h-3.5 w-3.5" />
      <span>{bulkApproved.length} high-risk items were bulk-approved</span>
    </div>
  );
}
