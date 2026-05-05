import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Fact, FactStatus } from '@/types';

export function useFactReview(_consultId: string, initialFacts: Fact[]) {
  const [facts, setFacts] = useState<Fact[]>(initialFacts);

  const updateFact = useCallback((factId: string, updates: Partial<Fact>) => {
    setFacts(prev => prev.map(f => f.id === factId ? { ...f, ...updates } : f));
  }, []);

  const revertFact = useCallback((factId: string, snapshot: Partial<Fact>) => {
    setFacts(prev => prev.map(f => f.id === factId ? { ...f, ...snapshot } : f));
  }, []);

  const approveFact = useCallback(async (factId: string) => {
    const prev = facts.find(f => f.id === factId);
    updateFact(factId, { status: 'approved', individuallyReviewed: true, reviewedAt: new Date().toISOString() });
    try {
      await api.patch(`/facts/${factId}`, { action: 'approved' });
    } catch {
      if (prev) revertFact(factId, { status: prev.status, individuallyReviewed: prev.individuallyReviewed, reviewedAt: prev.reviewedAt });
      toast.error('Failed to approve fact');
    }
  }, [facts, updateFact, revertFact]);

  const rejectFact = useCallback(async (factId: string) => {
    const prev = facts.find(f => f.id === factId);
    updateFact(factId, { status: 'rejected', individuallyReviewed: true, reviewedAt: new Date().toISOString() });
    try {
      await api.patch(`/facts/${factId}`, { action: 'rejected' });
    } catch {
      if (prev) revertFact(factId, { status: prev.status, individuallyReviewed: prev.individuallyReviewed, reviewedAt: prev.reviewedAt });
      toast.error('Failed to reject fact');
    }
  }, [facts, updateFact, revertFact]);

  const editFact = useCallback(async (factId: string, newText: string, structuredPayload?: Record<string, string>) => {
    const prev = facts.find(f => f.id === factId);
    setFacts(prevFacts => prevFacts.map(f => {
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
    try {
      await api.patch(`/facts/${factId}`, {
        action: 'edited',
        edited_value: structuredPayload || prev?.structuredPayload || {},
      });
    } catch {
      if (prev) revertFact(factId, { text: prev.text, structuredPayload: prev.structuredPayload, status: prev.status, individuallyReviewed: prev.individuallyReviewed, reviewedAt: prev.reviewedAt, editHistory: prev.editHistory });
      toast.error('Failed to save edit');
    }
  }, [facts, revertFact]);

  const markAudioPlayed = useCallback(async (factId: string) => {
    updateFact(factId, { audioPlayed: true });
    const fact = facts.find(f => f.id === factId);
    if (!fact) return;
    try {
      await api.patch(`/facts/${factId}`, { action: fact.status, audio_played: true });
    } catch {
      // Non-critical — don't revert or show error toast
    }
  }, [facts, updateFact]);

  const bulkApproveTier1 = useCallback(async () => {
    const tier1Pending = facts.filter(f => f.riskTier === 1 && f.status === 'pending');
    if (tier1Pending.length === 0) return;
    setFacts(prev => prev.map(f =>
      f.riskTier === 1 && f.status === 'pending'
        ? { ...f, status: 'approved' as FactStatus, individuallyReviewed: false, reviewedAt: new Date().toISOString() }
        : f
    ));
    const results = await Promise.allSettled(
      tier1Pending.map(f => api.patch(`/facts/${f.id}`, { action: 'approved' }))
    );
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) toast.error(`${failed} facts failed to save`);
  }, [facts]);

  const undoReject = useCallback(async (factId: string) => {
    updateFact(factId, { status: 'pending', reviewedAt: undefined });
    try {
      await api.patch(`/facts/${factId}`, { action: 'pending' });
    } catch {
      toast.error('Failed to undo rejection');
    }
  }, [updateFact]);

  // Re-sync facts when initialFacts changes (e.g. after loading from API)
  const resetFacts = useCallback((newFacts: Fact[]) => {
    setFacts(newFacts);
  }, []);

  const pendingCount = facts.filter(f => f.status === 'pending').length;
  const reviewedCount = facts.filter(f => f.status !== 'pending').length;
  const allReviewed = pendingCount === 0;
  const firstPendingFact = facts.find(f => f.status === 'pending');

  return {
    facts, approveFact, rejectFact, editFact, markAudioPlayed,
    bulkApproveTier1, undoReject, resetFacts,
    pendingCount, reviewedCount, allReviewed, firstPendingFact,
  };
}
