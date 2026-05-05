import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Recorder } from '@/components/consult/Recorder';
import { ProcessingStepper } from '@/components/consult/ProcessingStepper';
import { TranscriptViewer } from '@/components/consult/TranscriptViewer';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { api, ApiError } from '@/lib/api';

type Phase = 'idle' | 'recording' | 'uploading' | 'processing' | 'review' | 'failed';

interface CreateResponse {
  consult_id: string;
  upload_url: string;
}

interface StatusResponse {
  consult_id: string;
  status: string;
  sarvam_error: string | null;
  utterance_count: number;
}

interface ConsultDetail {
  id: string;
  status: string;
  utterances: Array<{
    idx: number;
    speaker_id: string;
    speaker_role: 'doctor' | 'patient' | 'unknown';
    text: string;
    start_sec: number;
    end_sec: number;
  }>;
  speaker_map?: { doctor_speaker_id: string; patient_speaker_id: string };
}

const STEP_LABEL: Record<string, number> = {
  uploaded: 0,
  transcribing: 1,
  extracting: 2,
  in_review: 2,
};

export default function NewConsult() {
  const navigate = useNavigate();
  const { consultId: routeConsultId } = useParams();
  const [searchParams] = useSearchParams();
  const queryPatientId = searchParams.get('patientId') ?? '';

  const recorder = useAudioRecorder();

  const [phase, setPhase] = useState<Phase>('idle');
  const [patientId, setPatientId] = useState(queryPatientId);
  const [consultId, setConsultId] = useState<string | null>(routeConsultId ?? null);
  const [statusText, setStatusText] = useState<string>('');
  const [stepIdx, setStepIdx] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConsultDetail | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const startPolling = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const s = await api.get<StatusResponse>(`/consults/${id}/status`);
        setStatusText(s.status);
        if (STEP_LABEL[s.status] !== undefined) setStepIdx(STEP_LABEL[s.status]);
        if (s.status === 'in_review' || s.status === 'finalized') {
          if (pollRef.current) clearInterval(pollRef.current);
          const d = await api.get<ConsultDetail>(`/consults/${id}`);
          setDetail(d);
          setPhase('review');
        } else if (s.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          setErrorMsg(s.sarvam_error || 'Transcription failed');
          setPhase('failed');
        }
      } catch (err) {
        if (pollRef.current) clearInterval(pollRef.current);
        setErrorMsg(err instanceof ApiError ? err.message : 'Polling failed');
        setPhase('failed');
      }
    }, 3000);
  }, []);

  const handleStartRecording = useCallback(async () => {
    if (!patientId.trim()) {
      toast.error('Enter a patient id to start');
      return;
    }
    setErrorMsg(null);
    setPhase('recording');
    try {
      await recorder.startRecording();
    } catch (err) {
      setPhase('idle');
      toast.error('Microphone access denied');
    }
  }, [patientId, recorder]);

  const handleStopRecording = useCallback(async () => {
    setPhase('uploading');
    setStatusText('uploading');
    try {
      // Stop the recorder and wait for the finalized blob (resolves from MediaRecorder.onstop)
      const blobPromise = recorder.stopAndGetBlob();

      // Run the consult creation in parallel with the recorder finalizing
      const created = await api.post<CreateResponse>('/consults', { patient_id: patientId.trim() });
      setConsultId(created.consult_id);

      const blob = await blobPromise;

      const putRes = await fetch(created.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': blob.type || 'audio/webm' },
        body: blob,
      });
      if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`);

      await api.post(`/consults/${created.consult_id}/finalize`, {
        audio_object_key: `raw/${created.consult_id}`,
      });

      setPhase('processing');
      setStepIdx(0);
      startPolling(created.consult_id);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : (err as Error).message);
      setPhase('failed');
    }
  }, [recorder, patientId, startPolling]);

  // Idle: ask for patient id, then show recorder
  if (phase === 'idle') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6 max-w-md mx-auto">
        <div className="w-full bg-card border border-border rounded-xl p-6 space-y-4">
          <div>
            <h1 className="text-lg font-medium">New consult</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Patient roster API isn't built yet — paste a patient user id (UUID) to record against.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Patient id</label>
            <input
              className="mt-1.5 w-full h-11 px-3 rounded-md border border-input bg-background text-sm font-mono"
              placeholder="00000000-0000-0000-0000-000000000000"
              value={patientId}
              onChange={e => setPatientId(e.target.value)}
            />
          </div>
          <Button
            className="w-full min-h-[44px]"
            disabled={!patientId.trim()}
            onClick={handleStartRecording}
          >
            Open recorder
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'recording') {
    return (
      <div className="flex-1 flex flex-col">
        <Recorder
          isRecording
          isPaused={recorder.isPaused}
          durationSec={recorder.durationSec}
          patientName={`Patient ${patientId.slice(0, 8)}…`}
          onStart={handleStartRecording}
          onStop={handleStopRecording}
          onPause={recorder.pauseRecording}
          onResume={recorder.resumeRecording}
        />
      </div>
    );
  }

  if (phase === 'uploading' || phase === 'processing') {
    return (
      <div className="flex-1 flex flex-col">
        <ProcessingStepper currentStep={stepIdx} />
        <p className="text-center text-xs text-muted-foreground mt-4">
          Status: {statusText || 'starting…'}
          {consultId && <span className="ml-2 font-mono">({consultId.slice(0, 8)}…)</span>}
        </p>
      </div>
    );
  }

  if (phase === 'failed') {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-card border border-border rounded-xl p-6 max-w-md text-center space-y-3">
          <h2 className="text-lg font-medium">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">{errorMsg ?? 'Unknown error'}</p>
          <Button onClick={() => { setPhase('idle'); setErrorMsg(null); }}>Try again</Button>
        </div>
      </div>
    );
  }

  // Review — transcript only for now; fact extraction + verification UI is not wired yet
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-medium">Transcript ready</h1>
          <p className="text-xs text-muted-foreground">
            Fact extraction and review aren't wired to the backend yet.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/doctor')}>Back</Button>
      </div>

      <div className="flex-1 overflow-hidden">
        {detail && (
          <TranscriptViewer
            utterances={detail.utterances.map(u => ({
              id: `${detail.id}-${u.idx}`,
              consultId: detail.id,
              idx: u.idx,
              speakerId: u.speaker_id,
              speakerRole: u.speaker_role,
              startSec: u.start_sec,
              endSec: u.end_sec,
              text: u.text,
            }))}
            highlightedIdxs={[]}
            doctorName="You"
            onSwapSpeakers={() => toast.message('Speaker swap will call PATCH /consults/:id/speaker — not wired yet')}
          />
        )}
      </div>
    </div>
  );
}
