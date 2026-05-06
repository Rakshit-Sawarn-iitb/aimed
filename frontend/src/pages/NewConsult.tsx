import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Recorder } from '@/components/consult/Recorder';
import { ProcessingStepper } from '@/components/consult/ProcessingStepper';
import { TranscriptViewer } from '@/components/consult/TranscriptViewer';
import { FactPanel } from '@/components/consult/FactPanel';
import { ReviewBottomBar } from '@/components/consult/ReviewBottomBar';
import { FinalizedView } from '@/components/consult/FinalizedView';
import type { ReportData } from '@/components/consult/FinalizedView';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useFactReview } from '@/hooks/useFactReview';
import { useMe, profileName } from '@/hooks/useMe';
import { api, ApiError } from '@/lib/api';
import type { Fact, RiskTier, FactCategory, FactStatus, Utterance } from '@/types';

type Phase = 'idle' | 'loading' | 'recording' | 'uploading' | 'processing' | 'review' | 'failed';

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
  patient_id?: string;
  finalized_at?: string;
  utterances: Array<{
    idx: number;
    speaker_id: string;
    speaker_role: 'doctor' | 'patient' | 'unknown';
    text: string;
    start_sec: number;
    end_sec: number;
  }>;
  speaker_map?: { doctor_speaker_id: string; patient_speaker_id: string };
  report?: ReportData;
}

interface FactApiResponse {
  id: string;
  category: FactCategory;
  text: string;
  structured_payload: Record<string, string>;
  evidence_quote: string;
  source_utterance_idx_arr: number[];
  risk_tier: number;
  risk_reason?: string;
  confidence: number;
  status: FactStatus;
  individually_reviewed: boolean;
  audio_played: boolean;
  reviewed_at?: string;
  edit_history: Array<{ text: string; editedAt: string }>;
  start_sec?: number;
  end_sec?: number;
}

const STEP_LABEL: Record<string, number> = {
  uploaded: 0,
  transcribing: 1,
  extracting: 2,
  in_review: 2,
};

function mapFact(f: FactApiResponse, consultId: string): Fact {
  return {
    id: f.id,
    consultId,
    patientId: '',
    category: f.category,
    text: f.text,
    structuredPayload: f.structured_payload,
    evidenceQuote: f.evidence_quote,
    sourceUtteranceIdxArr: f.source_utterance_idx_arr,
    riskTier: Math.min(3, Math.max(1, f.risk_tier)) as RiskTier,
    riskReason: f.risk_reason,
    confidence: f.confidence,
    status: f.status,
    individuallyReviewed: f.individually_reviewed,
    audioPlayed: f.audio_played,
    reviewedAt: f.reviewed_at,
    editHistory: f.edit_history || [],
    startSec: f.start_sec,
    endSec: f.end_sec,
  };
}

export default function NewConsult() {
  const navigate = useNavigate();
  const location = useLocation();
  const { consultId: routeConsultId } = useParams();
  const [searchParams] = useSearchParams();
  const statePatientName = (location.state as { patientName?: string } | null)?.patientName ?? null;
  const queryPatientId = searchParams.get('patientId') ?? '';

  const recorder = useAudioRecorder();
  const { me } = useMe();
  const doctorName = profileName(me) ? `Dr. ${profileName(me)}` : 'You';

  // If we're opening an existing consult, start in 'loading' so the idle
  // phone-search screen never flashes before the useEffect fires.
  const [phase, setPhase] = useState<Phase>(routeConsultId ? 'loading' : 'idle');
  const [patientId, setPatientId] = useState(queryPatientId);
  const [patientName, setPatientName] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneSearchState, setPhoneSearchState] = useState<'idle' | 'searching' | 'found' | 'not_found'>('idle');
  const [consultId, setConsultId] = useState<string | null>(routeConsultId ?? null);
  const [statusText, setStatusText] = useState<string>('');
  const [stepIdx, setStepIdx] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConsultDetail | null>(null);
  const [initialFacts, setInitialFacts] = useState<Fact[]>([]);
  const [factsLoading, setFactsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [doctorSpeakerId, setDoctorSpeakerId] = useState<'0' | '1'>('0');
  const [focusedIdxs, setFocusedIdxs] = useState<number[]>([]);
  const [isApproving, setIsApproving] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const factReview = useFactReview(consultId ?? '', initialFacts);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // Load facts + audio URL once we enter review
  const loadReviewData = useCallback(async (id: string, consultDetail: ConsultDetail) => {
    setDetail(consultDetail);
    if (consultDetail.speaker_map?.doctor_speaker_id) {
      setDoctorSpeakerId(consultDetail.speaker_map.doctor_speaker_id as '0' | '1');
    }

    setFactsLoading(true);
    try {
      const raw = await api.get<FactApiResponse[]>(`/consults/${id}/facts`);
      const mapped = raw.map(f => mapFact(f, id));
      setInitialFacts(mapped);
      factReview.resetFacts(mapped);
    } catch {
      toast.error('Could not load facts');
    } finally {
      setFactsLoading(false);
    }

    try {
      const { url } = await api.get<{ url: string }>(`/consults/${id}/audio-url`);
      setAudioUrl(url);
    } catch {
      // Non-critical — audio playback just won't work
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When navigating directly to /doctor/consult/:id, load the existing consult
  useEffect(() => {
    if (!routeConsultId) return;
    (async () => {
      try {
        const d = await api.get<ConsultDetail>(`/consults/${routeConsultId}`);
        setConsultId(routeConsultId);
        if (d.status === 'in_review' || d.status === 'finalized') {
          await loadReviewData(routeConsultId, d);
          setPhase('review');
        } else if (d.status === 'failed') {
          setErrorMsg('Consult pipeline failed');
          setPhase('failed');
        } else {
          setPhase('processing');
          setStepIdx(STEP_LABEL[d.status] ?? 0);
          startPolling(routeConsultId);
        }
      } catch {
        // Not found or auth error — fall through to idle
      }
    })();
  }, [routeConsultId]); // eslint-disable-line react-hooks/exhaustive-deps

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
          await loadReviewData(id, d);
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
  }, [loadReviewData]);

  const handlePhoneSearch = useCallback(async () => {
    const digits = phoneInput.replace(/\D/g, '');
    if (digits.length < 10) {
      toast.error('Enter a valid 10-digit mobile number');
      return;
    }
    setPhoneSearchState('searching');
    try {
      const searchPhone = `91${digits}`;
      const patient = await api.get<{ id: string; name: string }>(`/patients/by-phone/${searchPhone}`);
      setPatientId(patient.id);
      setPatientName(patient.name);
      setPhoneSearchState('found');
    } catch {
      setPhoneSearchState('not_found');
    }
  }, [phoneInput]);

  const handleStartRecording = useCallback(async () => {
    if (!patientId.trim()) {
      toast.error('Enter a patient id to start');
      return;
    }
    setErrorMsg(null);
    setPhase('recording');
    try {
      await recorder.startRecording();
    } catch {
      setPhase('idle');
      toast.error('Microphone access denied');
    }
  }, [patientId, recorder]);

  const handleStopRecording = useCallback(async () => {
    setPhase('uploading');
    setStatusText('uploading');
    try {
      const blobPromise = recorder.stopAndGetBlob();
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

  const handleSwapSpeakers = useCallback(async () => {
    if (!consultId) return;
    const newId = doctorSpeakerId === '0' ? '1' : '0';
    try {
      await api.patch(`/consults/${consultId}/speaker`, { doctor_speaker_id: newId });
      setDoctorSpeakerId(newId);
      const d = await api.get<ConsultDetail>(`/consults/${consultId}`);
      setDetail(d);
      toast.success('Speaker labels updated. SOAP note regenerating…');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Speaker swap failed');
    }
  }, [consultId, doctorSpeakerId]);

  const handleApproveConsult = useCallback(async () => {
    if (!consultId) return;
    setIsApproving(true);
    try {
      await api.post(`/consults/${consultId}/approve`);
      toast.success('Consult approved and finalized!');
      navigate('/doctor');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to approve consult');
    } finally {
      setIsApproving(false);
    }
  }, [consultId, navigate]);

  const handleFocusFact = useCallback((factId: string) => {
    const fact = factReview.facts.find(f => f.id === factId);
    if (fact) setFocusedIdxs(fact.sourceUtteranceIdxArr);
  }, [factReview.facts]);

  // ── Phases ──────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (phase === 'idle') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">
        <div className="w-full bg-card border border-border rounded-xl p-6 space-y-5">
          <h1 className="text-lg font-medium">New consult</h1>

          {/* Phone search */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Patient mobile number</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">+91</span>
                <input
                  className="w-full h-11 pl-10 pr-3 rounded-md border border-input bg-background text-sm"
                  placeholder="98765 43210"
                  value={phoneInput}
                  maxLength={10}
                  inputMode="numeric"
                  onChange={e => {
                    setPhoneInput(e.target.value.replace(/\D/g, ''));
                    setPhoneSearchState('idle');
                    setPatientId('');
                    setPatientName(null);
                  }}
                  onKeyDown={e => e.key === 'Enter' && handlePhoneSearch()}
                />
              </div>
              <Button
                variant="outline"
                className="h-11 px-4 shrink-0"
                disabled={phoneInput.length < 10 || phoneSearchState === 'searching'}
                onClick={handlePhoneSearch}
              >
                {phoneSearchState === 'searching' ? 'Searching…' : 'Find'}
              </Button>
            </div>

            {/* Result states */}
            {phoneSearchState === 'found' && patientName && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-success/10 border border-success/20">
                <span className="text-success text-sm">✓</span>
                <span className="text-sm font-medium">{patientName}</span>
              </div>
            )}
            {phoneSearchState === 'not_found' && (
              <p className="text-sm text-danger">No patient found with this number.</p>
            )}
          </div>

          <Button
            className="w-full min-h-[44px]"
            disabled={phoneSearchState !== 'found' || !patientId}
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
          patientName={patientName ?? `Patient ${patientId.slice(0, 8)}…`}
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

  // Finalized — read-only SOAP view
  if (detail?.status === 'finalized' && detail.report) {
    return (
      <FinalizedView
        report={detail.report}
        patientName={patientName ?? statePatientName}
        finalizedAt={detail.finalized_at}
      />
    );
  }

  // Review — two-panel layout matching the target UI
  const utterances: Utterance[] = (detail?.utterances ?? []).map(u => ({
    id: `${detail!.id}-${u.idx}`,
    consultId: detail!.id,
    idx: u.idx,
    speakerId: u.speaker_id,
    speakerRole: u.speaker_role,
    startSec: u.start_sec,
    endSec: u.end_sec,
    text: u.text,
  }));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Two-panel main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Transcript */}
        <div className="hidden md:flex w-1/2 border-r border-border flex-col overflow-hidden">
          <TranscriptViewer
            utterances={utterances}
            highlightedIdxs={focusedIdxs}
            doctorName={doctorName}
            doctorSpeakerId={doctorSpeakerId}
            onSwapSpeakers={handleSwapSpeakers}
          />
        </div>

        {/* Right: Facts */}
        <div className="flex-1 md:w-1/2 flex flex-col overflow-hidden">
          {factsLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground animate-pulse">Loading facts…</p>
            </div>
          ) : factReview.facts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <p className="text-sm text-muted-foreground text-center">
                No facts extracted for this consult.
              </p>
            </div>
          ) : (
            <FactPanel
              facts={factReview.facts}
              onApprove={factReview.approveFact}
              onReject={factReview.rejectFact}
              onEdit={factReview.editFact}
              onAudioPlay={factReview.markAudioPlayed}
              onFocusFact={handleFocusFact}
              onBulkApproveTier1={factReview.bulkApproveTier1}
              audioUrl={audioUrl ?? undefined}
            />
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <ReviewBottomBar
        reviewedCount={factReview.reviewedCount}
        totalCount={factReview.facts.length}
        allReviewed={factReview.allReviewed}
        isApproving={isApproving}
        onFreeze={handleApproveConsult}
      />
    </div>
  );
}
