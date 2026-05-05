import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { Recorder } from '@/components/consult/Recorder';
import { ProcessingStepper } from '@/components/consult/ProcessingStepper';
import { TranscriptViewer } from '@/components/consult/TranscriptViewer';
import { FactPanel } from '@/components/consult/FactPanel';
import { ReviewBottomBar } from '@/components/consult/ReviewBottomBar';
import { Button } from '@/components/ui/button';
import { useConsult, type ConsultState } from '@/hooks/useConsult';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useFactReview } from '@/hooks/useFactReview';
import { mockConsult, mockPatient, mockDoctor } from '@/lib/mockData';

export default function NewConsult() {
  const navigate = useNavigate();
  const { state, startRecording: startConsultRecording, stopRecording: stopConsultRecording, startProcessing, advanceProcessing, startReview, freeze } = useConsult();
  const recorder = useAudioRecorder();
  const factReview = useFactReview(mockConsult.facts);
  const [focusedFactId, setFocusedFactId] = useState<string | null>(null);
  const [swapped, setSwapped] = useState(false);

  const utterances = useMemo(() => {
    if (!swapped) return mockConsult.utterances;
    return mockConsult.utterances.map(u => ({
      ...u,
      speakerRole: u.speakerRole === 'doctor' ? 'patient' as const : u.speakerRole === 'patient' ? 'doctor' as const : u.speakerRole,
    }));
  }, [swapped]);

  const highlightedIdxs = useMemo(() => {
    if (!focusedFactId) return [];
    const fact = factReview.facts.find(f => f.id === focusedFactId);
    return fact?.sourceUtteranceIdxArr || [];
  }, [focusedFactId, factReview.facts]);

  const handleStartRecording = useCallback(async () => {
    startConsultRecording();
    await recorder.startRecording();
  }, [startConsultRecording, recorder]);

  const handleStopRecording = useCallback(() => {
    recorder.stopRecording();
    stopConsultRecording();
    // Simulate upload + processing
    startProcessing('c1');
    setTimeout(() => advanceProcessing(1), 1500);
    setTimeout(() => advanceProcessing(2), 3000);
    setTimeout(() => startReview(), 4500);
  }, [recorder, stopConsultRecording, startProcessing, advanceProcessing, startReview]);

  const handleFreeze = useCallback(() => {
    if (!factReview.allReviewed) {
      toast.error(`${factReview.pendingCount} facts still need review`);
      return;
    }
    freeze();
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
  }, [factReview, freeze]);

  // Idle or Recording
  if (state === 'idle' || state === 'recording') {
    return (
      <div className="flex-1 flex flex-col">
        <Recorder
          isRecording={state === 'recording'}
          isPaused={recorder.isPaused}
          durationSec={recorder.durationSec}
          patientName={`${mockPatient.fullName}, ${new Date().getFullYear() - new Date(mockPatient.dob!).getFullYear()}`}
          onStart={handleStartRecording}
          onStop={handleStopRecording}
          onPause={recorder.pauseRecording}
          onResume={recorder.resumeRecording}
        />
      </div>
    );
  }

  // Uploading / Processing
  if (state === 'uploading' || state === 'processing') {
    return (
      <div className="flex-1 flex flex-col">
        <ProcessingStepper currentStep={state === 'uploading' ? 0 : Math.min(2, mockConsult.facts.length > 0 ? 2 : 1)} />
      </div>
    );
  }

  // Frozen
  if (state === 'frozen') {
    const highRisk = factReview.facts.filter(f => f.riskTier === 3);
    const audioPlayedCount = highRisk.filter(f => f.audioPlayed).length;
    const editedCount = factReview.facts.filter(f => f.status === 'edited').length;

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
        <div className="bg-card border border-border rounded-xl p-8 max-w-md text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <span className="text-success text-xl">✓</span>
          </div>
          <h2 className="text-lg font-medium">Record finalized and sent to {mockPatient.fullName}</h2>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>You reviewed {factReview.facts.length} facts individually.</p>
            <p>Audio played for {audioPlayedCount} of {highRisk.length} high-risk items.</p>
            {editedCount > 0 && <p>{editedCount} fact{editedCount > 1 ? 's' : ''} edited.</p>}
          </div>
          <div className="flex gap-3 justify-center pt-2">
            <Button variant="outline" className="min-h-[44px]" onClick={() => navigate('/doctor')}>View full record</Button>
            <Button className="min-h-[44px]">Share with another doctor →</Button>
          </div>
        </div>
      </div>
    );
  }

  // Review state (default)
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Desktop: split layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Transcript (left) */}
        <div className="hidden md:flex md:w-[40%] border-r border-border flex-col overflow-hidden">
          <TranscriptViewer
            utterances={utterances}
            highlightedIdxs={highlightedIdxs}
            doctorName={mockDoctor.fullName}
            onSwapSpeakers={() => setSwapped(s => !s)}
          />
        </div>

        {/* Mobile: transcript accordion */}
        <div className="md:hidden border-b border-border">
          <details className="group">
            <summary className="px-4 py-3 text-sm font-medium cursor-pointer text-primary min-h-[44px] flex items-center">
              View transcript
            </summary>
            <div className="max-h-64 overflow-y-auto">
              <TranscriptViewer
                utterances={utterances}
                highlightedIdxs={highlightedIdxs}
                doctorName={mockDoctor.fullName}
                onSwapSpeakers={() => setSwapped(s => !s)}
              />
            </div>
          </details>
        </div>

        {/* Facts (right) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <FactPanel
            facts={factReview.facts}
            onApprove={factReview.approveFact}
            onReject={factReview.rejectFact}
            onEdit={factReview.editFact}
            onAudioPlay={factReview.markAudioPlayed}
            onFocusFact={setFocusedFactId}
            onBulkApproveTier1={factReview.bulkApproveTier1}
          />
        </div>
      </div>

      <ReviewBottomBar
        reviewedCount={factReview.reviewedCount}
        totalCount={factReview.facts.length}
        allReviewed={factReview.allReviewed}
        onFreeze={handleFreeze}
      />
    </div>
  );
}
