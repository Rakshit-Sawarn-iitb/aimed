import { Play, Pause, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTimeRange } from '@/lib/audio';
import { useState } from 'react';

// Single audio element shared across all fact cards — only one clip plays at a time
let _stopCurrent: (() => void) | null = null;

function playClip(url: string, startSec: number, endSec: number, onEnd: () => void) {
  if (_stopCurrent) _stopCurrent();

  const audio = new Audio(url);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    audio.pause();
    audio.ontimeupdate = null;
    onEnd();
  };
  _stopCurrent = stop;

  audio.currentTime = startSec;
  audio.ontimeupdate = () => {
    if (audio.currentTime >= endSec) stop();
  };
  audio.onended = stop;
  audio.play().catch(() => stop());
}

interface AudioAnchorProps {
  startSec: number;
  endSec: number;
  played: boolean;
  onPlay: () => void;
  audioUrl?: string;
}

export function AudioAnchor({ startSec, endSec, played, onPlay, audioUrl }: AudioAnchorProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleClick = () => {
    if (isPlaying) {
      if (_stopCurrent) _stopCurrent();
      setIsPlaying(false);
      return;
    }

    if (!audioUrl) {
      // No real audio yet — just mark played
      onPlay();
      return;
    }

    setIsPlaying(true);
    playClip(audioUrl, startSec, endSec, () => {
      setIsPlaying(false);
      onPlay();
    });
  };

  if (played) {
    return (
      <button className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-success/10 text-success text-xs font-medium">
        <Check className="h-3 w-3" />
        {formatTimeRange(startSec, endSec)}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-primary text-primary text-xs font-medium hover:bg-primary/5 transition-colors',
        isPlaying && 'animate-pulse border-primary/60'
      )}
    >
      {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      {formatTimeRange(startSec, endSec)}
    </button>
  );
}
