import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { Utterance } from '@/types';

interface TranscriptViewerProps {
  utterances: Utterance[];
  highlightedIdxs: number[];
  doctorName: string;
  onSwapSpeakers: () => void;
}

export function TranscriptViewer({ utterances, highlightedIdxs, doctorName, onSwapSpeakers }: TranscriptViewerProps) {
  const refs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (highlightedIdxs.length > 0) {
      const first = highlightedIdxs[0];
      refs.current[first]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedIdxs]);

  return (
    <div className="flex flex-col h-full">
      {/* Speaker assignment */}
      <div className="p-3 border-b border-border bg-secondary/50 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Speaker assignment</p>
        <div className="flex items-center justify-between">
          <div className="text-xs space-y-1">
            <p>Speaker 0 → <span className="font-medium">Doctor</span></p>
            <p>Speaker 1 → <span className="font-medium">Patient</span></p>
          </div>
          <button
            className="text-xs text-primary font-medium hover:underline min-h-[44px] px-3"
            onClick={onSwapSpeakers}
          >
            Swap
          </button>
        </div>
      </div>

      {/* Utterances */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {utterances.map(u => (
          <div
            key={u.idx}
            ref={el => { refs.current[u.idx] = el; }}
            className={cn(
              'rounded-lg p-3 transition-colors',
              highlightedIdxs.includes(u.idx) && 'bg-primary/5 ring-1 ring-primary/20'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={cn(
                'text-[11px] font-medium px-2 py-0.5 rounded-full',
                u.speakerRole === 'doctor' ? 'bg-primary text-primary-foreground' :
                u.speakerRole === 'patient' ? 'bg-secondary text-secondary-foreground' :
                'border border-dashed border-border text-muted-foreground'
              )}>
                {u.speakerRole === 'doctor' ? doctorName : u.speakerRole === 'patient' ? 'Patient' : 'Unknown'}
              </span>
            </div>
            <p className="text-sm text-foreground">{u.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
