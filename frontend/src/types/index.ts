export type UserRole = 'doctor' | 'patient';

export type ConsultStatus =
  | 'recording' | 'uploaded' | 'transcribing'
  | 'extracting' | 'in_review' | 'finalized' | 'failed';

export type FactCategory =
  | 'chief_complaint' | 'hpi' | 'past_history' | 'current_medication'
  | 'allergy' | 'vital' | 'exam_finding' | 'assessment_observation'
  | 'plan' | 'follow_up' | 'social_history';

export type FactStatus = 'pending' | 'approved' | 'rejected' | 'edited';

export type RiskTier = 1 | 2 | 3;

export type FlagType = 'didnt_say' | 'missing' | 'wrong' | 'unclear';

export interface Fact {
  id: string;
  consultId: string;
  patientId: string;
  category: FactCategory;
  text: string;
  structuredPayload?: Record<string, string>;
  evidenceQuote: string;
  sourceUtteranceIdxArr: number[];
  riskTier: RiskTier;
  riskReason?: string;
  confidence: number;
  status: FactStatus;
  individuallyReviewed: boolean;
  audioPlayed: boolean;
  reviewedAt?: string;
  editHistory: Array<{ text: string; editedAt: string }>;
  startSec?: number;
  endSec?: number;
}

export interface Utterance {
  id: string;
  consultId: string;
  idx: number;
  speakerId: string;
  speakerRole: 'doctor' | 'patient' | 'unknown';
  startSec: number;
  endSec: number;
  text: string;
}

export interface Consult {
  id: string;
  patientId: string;
  doctorId: string;
  status: ConsultStatus;
  audioDurationSec?: number;
  facts: Fact[];
  utterances: Utterance[];
  startedAt: string;
  finalizedAt?: string;
}

export interface ConsultListItem {
  id: string;
  patient_id: string;
  patient_name?: string;
  status: ConsultStatus;
  started_at?: string;
  finalized_at?: string;
  created_at?: string;
  sarvam_error?: string;
}

export interface PatientProfile {
  userId: string;
  fullName: string;
  dob?: string;
  sex?: 'M' | 'F' | 'O' | 'U';
  bloodGroup?: string;
  openFlagCount: number;
}

export interface DoctorProfile {
  userId: string;
  fullName: string;
  specialty: string;
  registrationNumber: string;
  clinicName: string;
}

export interface ShareLink {
  id: string;
  token: string;
  grantedToPhone?: string;
  expiresAt: string;
  revokedAt?: string;
  accessLog: Array<{ accessedAt: string; phone?: string }>;
}

export interface PatientFlag {
  id: string;
  factId: string;
  flagType: FlagType;
  note?: string;
  createdAt: string;
}

export const CATEGORY_LABELS: Record<FactCategory, string> = {
  chief_complaint: 'Chief Complaint',
  hpi: 'History of Present Illness',
  past_history: 'Past History',
  current_medication: 'Medication',
  allergy: 'Allergy',
  vital: 'Vitals',
  exam_finding: 'Exam Finding',
  assessment_observation: 'Assessment',
  plan: 'Plan',
  follow_up: 'Follow-up',
  social_history: 'Social History',
};

export const CATEGORY_TIER: Record<FactCategory, RiskTier> = {
  chief_complaint: 1,
  hpi: 1,
  past_history: 1,
  current_medication: 3,
  allergy: 3,
  vital: 2,
  exam_finding: 2,
  assessment_observation: 2,
  plan: 2,
  follow_up: 2,
  social_history: 1,
};
