import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AudioAnchor } from './AudioAnchor';
import { TierBadge } from '@/components/shared/TierBadge';
import type { Fact } from '@/types';
import { CATEGORY_LABELS } from '@/types';

interface FactCardProps {
  fact: Fact;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (id: string, text: string, structured?: Record<string, string>) => void;
  onAudioPlay: (id: string) => void;
  onFocus?: (id: string) => void;
  readOnly?: boolean;
  audioUrl?: string;
}

export function FactCard({ fact, onApprove, onReject, onEdit, onAudioPlay, onFocus, readOnly = false, audioUrl }: FactCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(fact.text);
  const [editPayload, setEditPayload] = useState(fact.structuredPayload || {});
  const [attestedViaQuote, setAttestedViaQuote] = useState(false);
  const [confirmingReject, setConfirmingReject] = useState(false);

  const canApprove = fact.riskTier < 3 || fact.audioPlayed || attestedViaQuote;

  const borderColor = fact.status === 'approved' ? 'border-l-success' :
    fact.status === 'rejected' ? 'border-l-danger' :
    fact.status === 'edited' ? 'border-l-warning' : '';

  const handleSaveEdit = useCallback(() => {
    onEdit(fact.id, editText, fact.structuredPayload ? editPayload : undefined);
    setIsEditing(false);
  }, [fact.id, editText, editPayload, fact.structuredPayload, onEdit]);

  const audioStart = fact.startSec ?? 0;
  const audioEnd = fact.endSec ?? audioStart + 7;

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-4 transition-all',
        borderColor && `border-l-2 ${borderColor}`,
        fact.status === 'rejected' && 'opacity-50',
      )}
      onClick={() => onFocus?.(fact.id)}
      role="button"
      tabIndex={0}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
            {CATEGORY_LABELS[fact.category]}
          </span>
          {fact.status === 'edited' && (
            <span className="text-[11px] font-medium text-warning bg-tier2-bg px-1.5 py-0.5 rounded">Edited</span>
          )}
        </div>
        <TierBadge tier={fact.riskTier} />
      </div>

      {/* Fact text or edit mode */}
      {isEditing ? (
        <div className="space-y-3">
          {fact.structuredPayload && fact.riskTier === 3 ? (
            <div className="grid grid-cols-2 gap-2">
              {['drug', 'dose', 'frequency', 'route', 'duration'].map(field => (
                <div key={field}>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase">{field}</label>
                  <input
                    className="w-full mt-1 h-9 px-2 rounded-md border border-input bg-background text-sm"
                    value={editPayload[field] || ''}
                    onChange={e => setEditPayload(prev => ({ ...prev, [field]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          ) : null}
          <textarea
            className="w-full h-20 px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
            value={editText}
            onChange={e => setEditText(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveEdit}>Save</Button>
            <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-[15px] text-foreground mb-2">{fact.text}</p>

          {/* Structured payload chips for Tier 3 meds */}
          {fact.structuredPayload && fact.riskTier === 3 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {Object.entries(fact.structuredPayload).map(([key, val]) => (
                <span key={key} className="text-[12px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  {val}
                </span>
              ))}
            </div>
          )}

          {/* Evidence quote */}
          <div className={cn(
            'text-[13px] italic text-muted-foreground pl-3 mb-3 border-l-2',
            fact.riskTier === 1 && 'border-tier1-border',
            fact.riskTier === 2 && 'border-tier2-border',
            fact.riskTier === 3 && 'border-tier3-border',
          )}>
            "{fact.evidenceQuote}"
          </div>

          {/* Audio anchor */}
          <div className="mb-3">
            <AudioAnchor
              startSec={audioStart}
              endSec={audioEnd}
              played={fact.audioPlayed}
              onPlay={() => onAudioPlay(fact.id)}
              audioUrl={audioUrl}
            />
          </div>

          {/* Actions */}
          {!readOnly && fact.status === 'pending' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={!canApprove}
                  onClick={() => onApprove(fact.id)}
                  title={!canApprove ? 'Play the audio clip or confirm you\'ve read the quote first.' : undefined}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </Button>
                {!confirmingReject ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs text-danger hover:text-danger"
                    onClick={() => setConfirmingReject(true)}
                  >
                    Reject
                  </Button>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Are you sure?</span>
                    <Button size="sm" variant="outline" className="h-7 text-xs text-danger" onClick={() => { onReject(fact.id); setConfirmingReject(false); }}>
                      Yes, reject
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmingReject(false)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

              {fact.riskTier === 3 && !fact.audioPlayed && !attestedViaQuote && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                  onClick={() => setAttestedViaQuote(true)}
                >
                  I've read the quote, skip audio
                </button>
              )}
            </div>
          )}

          {/* Approved / Rejected states */}
          {fact.status === 'approved' && (
            <span className="inline-flex items-center text-xs font-medium text-success">✓ Approved</span>
          )}
          {fact.status === 'edited' && !isEditing && (
            <span className="inline-flex items-center text-xs font-medium text-success">✓ Approved (edited)</span>
          )}
          {fact.status === 'rejected' && (
            <span className="text-xs text-muted-foreground">Rejected</span>
          )}
        </>
      )}
    </div>
  );
}
