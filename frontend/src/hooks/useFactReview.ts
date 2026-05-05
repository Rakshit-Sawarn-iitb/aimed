import { useCallback, useState } from 'react';
import type { Fact, FactStatus } from '@/types';

export function useFactReview(initialFacts: Fact[]) {
  const [facts, setFacts] = useState<Fact[]>(initialFacts);

  const updateFact = useCallback((factId: string, updates: Partial<Fact>) => {
    setFacts(prev => prev.map(f => f.id === factId ? { ...f, ...updates } : f));
  }, []);

  const approveFact = useCallback((factId: string) => {
    updateFact(factId, {
      status: 'approved' as FactStatus,
      individuallyReviewed: true,
      reviewedAt: new Date().toISOString(),
    });
  }, [updateFact]);

  const rejectFact = useCallback((factId: string) => {
    updateFact(factId, {
      status: 'rejected' as FactStatus,
      individuallyReviewed: true,
      reviewedAt: new Date().toISOString(),
    });
  }, [updateFact]);

  const editFact = useCallback((factId: string, newText: string, structuredPayload?: Record<string, string>) => {
    setFacts(prev => prev.map(f => {
      if (f.id !== factId) return f;
      return {
        ...f,
        text: newText,
        structuredPayload: structuredPayload || f.structuredPayload,
        status: 'edited' as FactStatus,
        individuallyReviewed: true,
        reviewedAt: new Date().toISOString(),
        editHistory: [...f.editHistory, { text: f.text, editedAt: new Date().toISOString() }],
      };
    }));
  }, []);

  const markAudioPlayed = useCallback((factId: string) => {
    updateFact(factId, { audioPlayed: true });
  }, [updateFact]);

  const bulkApproveTier1 = useCallback(() => {
    setFacts(prev => prev.map(f => {
      if (f.riskTier === 1 && f.status === 'pending') {
        return { ...f, status: 'approved' as FactStatus, individuallyReviewed: false, reviewedAt: new Date().toISOString() };
      }
      return f;
    }));
  }, []);

  const undoReject = useCallback((factId: string) => {
    updateFact(factId, { status: 'pending' as FactStatus, reviewedAt: undefined });
  }, [updateFact]);

  const pendingCount = facts.filter(f => f.status === 'pending').length;
  const reviewedCount = facts.filter(f => f.status !== 'pending').length;
  const allReviewed = pendingCount === 0;
  const firstPendingFact = facts.find(f => f.status === 'pending');

  return {
    facts, approveFact, rejectFact, editFact, markAudioPlayed, bulkApproveTier1, undoReject,
    pendingCount, reviewedCount, allReviewed, firstPendingFact,
  };
}
