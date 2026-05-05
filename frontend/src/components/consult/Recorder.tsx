import { Mic, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/audio';

interface RecorderProps {
  isRecording: boolean;
  isPaused: boolean;
  durationSec: number;
  patientName: string;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
}

export function Recorder({ isRecording, isPaused, durationSec, patientName, onStart, onStop, onPause, onResume }: RecorderProps) {
  if (!isRecording) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <h2 className="text-lg font-medium text-foreground">{patientName}</h2>
        <div className="text-center bg-tier2-bg rounded-lg px-4 py-3 max-w-sm">
          <p className="text-sm text-tier2-text">
            Remind the patient: "I'm recording this for your medical record."
          </p>
        </div>
        <button
          onClick={onStart}
          className="h-24 w-24 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors shadow-lg"
        >
          <Mic className="h-10 w-10 text-primary-foreground" />
        </button>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          Recording will be transcribed in Hindi-English. Audio is kept for 30 days.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-6">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-danger animate-pulse-dot" />
        <span className="text-sm font-medium text-danger">Recording</span>
        <span className="text-sm text-muted-foreground">· {patientName}</span>
      </div>

      <div className="flex items-center gap-1 h-8">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className={cn('w-1 rounded-full bg-primary', !isPaused && 'animate-waveform')}
            style={{ animationDelay: `${i * 0.05}s`, ...(isPaused ? { height: '8px' } : {}) }}
          />
        ))}
      </div>

      <p className="text-2xl font-medium text-foreground tabular-nums">{formatTime(durationSec)}</p>

      <button
        onClick={onStop}
        className="h-20 w-20 rounded-full bg-danger flex items-center justify-center hover:bg-danger/90 transition-colors shadow-lg"
      >
        <Square className="h-8 w-8 text-primary-foreground fill-current" />
      </button>

      <button
        onClick={isPaused ? onResume : onPause}
        className="text-sm text-muted-foreground hover:text-foreground min-h-[44px]"
      >
        {isPaused ? 'Resume' : 'Pause'}
      </button>
    </div>
  );
}
