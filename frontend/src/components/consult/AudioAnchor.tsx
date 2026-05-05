import { Play, Pause, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTimeRange } from '@/lib/audio';
import { useState } from 'react';

interface AudioAnchorProps {
  startSec: number;
  endSec: number;
  played: boolean;
  onPlay: () => void;
}

export function AudioAnchor({ startSec, endSec, played, onPlay }: AudioAnchorProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleClick = () => {
    if (played) return;
    setIsPlaying(true);
    onPlay();
    // Simulate playback ending
    setTimeout(() => setIsPlaying(false), (endSec - startSec) * 1000);
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
