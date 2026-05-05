import { useState } from 'react';

export type ConsultState = 'idle' | 'recording' | 'uploading' | 'processing' | 'reviewing' | 'frozen';

export function useConsult() {
  const [state, setState] = useState<ConsultState>('idle');
  const [consultId, setConsultId] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState(0);

  const startRecording = () => setState('recording');
  const stopRecording = () => setState('uploading');
  const startProcessing = (id: string) => {
    setConsultId(id);
    setState('processing');
    setProcessingStep(0);
  };
  const advanceProcessing = (step: number) => setProcessingStep(step);
  const startReview = () => setState('reviewing');
  const freeze = () => setState('frozen');
  const fail = () => setState('idle');

  return {
    state, consultId, processingStep,
    startRecording, stopRecording, startProcessing,
    advanceProcessing, startReview, freeze, fail,
  };
}
