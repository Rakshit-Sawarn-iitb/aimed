import { cn } from '@/lib/utils';
import type { RiskTier } from '@/types';

const tierConfig: Record<RiskTier, { label: string; className: string }> = {
  1: { label: 'Tier 1 · Info', className: 'bg-tier1-bg text-tier1-text border-tier1-border' },
  2: { label: 'Tier 2 · Review', className: 'bg-tier2-bg text-tier2-text border-tier2-border' },
  3: { label: 'Tier 3 · High risk', className: 'bg-tier3-bg text-tier3-text border-tier3-border' },
};

interface TierBadgeProps {
  tier: RiskTier;
  className?: string;
}

export function TierBadge({ tier, className }: TierBadgeProps) {
  const config = tierConfig[tier];
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium', config.className, className)}>
      {config.label}
    </span>
  );
}
