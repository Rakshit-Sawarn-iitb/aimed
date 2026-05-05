import { useMemo, useState } from 'react';
import { FactCard } from './FactCard';
import { Button } from '@/components/ui/button';
import type { Fact, RiskTier } from '@/types';
import { CATEGORY_LABELS, type FactCategory } from '@/types';

interface FactPanelProps {
  facts: Fact[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (id: string, text: string, structured?: Record<string, string>) => void;
  onAudioPlay: (id: string) => void;
  onFocusFact: (id: string) => void;
  onBulkApproveTier1: () => void;
  readOnly?: boolean;
  audioUrl?: string;
}

export function FactPanel({ facts, onApprove, onReject, onEdit, onAudioPlay, onFocusFact, onBulkApproveTier1, readOnly = false, audioUrl }: FactPanelProps) {
  // Group by tier, then by category. Tier 3 pinned at top.
  const grouped = useMemo(() => {
    const tiers: Record<RiskTier, Record<string, Fact[]>> = { 3: {}, 2: {}, 1: {} };
    for (const f of facts) {
      const cat = f.category;
      if (!tiers[f.riskTier][cat]) tiers[f.riskTier][cat] = [];
      tiers[f.riskTier][cat].push(f);
    }
    return tiers;
  }, [facts]);

  const tier1HasPending = facts.some(f => f.riskTier === 1 && f.status === 'pending');

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-6">
      {([3, 2, 1] as RiskTier[]).map(tier => {
        const categories = grouped[tier];
        const catKeys = Object.keys(categories) as FactCategory[];
        if (catKeys.length === 0) return null;

        return (
          <div key={tier} className="space-y-4">
            {tier === 1 && !readOnly && tier1HasPending && (
              <div className="flex justify-end">
                <Button size="sm" variant="outline" className="text-xs h-8" onClick={onBulkApproveTier1}>
                  Approve all Tier 1
                </Button>
              </div>
            )}

            {catKeys.map(cat => (
              <div key={cat}>
                <h3 className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase mb-2 sticky top-0 bg-background py-1 z-10">
                  {CATEGORY_LABELS[cat]}
                </h3>
                <div className="space-y-3">
                  {categories[cat].map(fact => (
                    <FactCard
                      key={fact.id}
                      fact={fact}
                      onApprove={onApprove}
                      onReject={onReject}
                      onEdit={onEdit}
                      onAudioPlay={onAudioPlay}
                      onFocus={onFocusFact}
                      readOnly={readOnly}
                      audioUrl={audioUrl}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
