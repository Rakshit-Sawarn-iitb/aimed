import { useCallback, useRef, useState } from 'react';
import { getSupportedMimeType } from '@/lib/audio';

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  durationSec: number;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  stopAndGetBlob: () => Promise<Blob>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  audioBlob: Blob | null;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const mimeRef = useRef<string>('audio/webm');
  // Pending promise resolvers for stopAndGetBlob
  const stopResolversRef = useRef<Array<(blob: Blob) => void>>([]);
  const stopRejectorsRef = useRef<Array<(err: Error) => void>>([]);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setDurationSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = getSupportedMimeType();
    mimeRef.current = mimeType;
    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    setAudioBlob(null);
    setDurationSec(0);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeRef.current });
      setAudioBlob(blob);
      stream.getTracks().forEach(t => t.stop());
      stopTimer();
      // Resolve any pending stopAndGetBlob() callers
      const resolvers = stopResolversRef.current;
      stopResolversRef.current = [];
      stopRejectorsRef.current = [];
      resolvers.forEach(r => r(blob));
    };

    recorder.onerror = (e) => {
      const rejectors = stopRejectorsRef.current;
      stopResolversRef.current = [];
      stopRejectorsRef.current = [];
      rejectors.forEach(r => r(new Error(`MediaRecorder error: ${(e as Event).type}`)));
    };

    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setIsPaused(false);
    startTimer();
  }, [startTimer, stopTimer]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  const stopAndGetBlob = useCallback((): Promise<Blob> => {
    return new Promise<Blob>((resolve, reject) => {
      const r = mediaRecorderRef.current;
      if (!r) return reject(new Error('Recorder not started'));
      // If already stopped (state="inactive"), return the existing blob
      if (r.state === 'inactive') {
        if (chunksRef.current.length > 0) {
          return resolve(new Blob(chunksRef.current, { type: mimeRef.current }));
        }
        return reject(new Error('Recorder already stopped with no data'));
      }
      stopResolversRef.current.push(resolve);
      stopRejectorsRef.current.push(reject);
      r.stop();
      setIsRecording(false);
      setIsPaused(false);
    });
  }, []);

  const pauseRecording = useCallback(() => {
    mediaRecorderRef.current?.pause();
    setIsPaused(true);
    stopTimer();
  }, [stopTimer]);

  const resumeRecording = useCallback(() => {
    mediaRecorderRef.current?.resume();
    setIsPaused(false);
    startTimer();
  }, [startTimer]);

  return {
    isRecording,
    isPaused,
    durationSec,
    startRecording,
    stopRecording,
    stopAndGetBlob,
    pauseRecording,
    resumeRecording,
    audioBlob,
  };
}
