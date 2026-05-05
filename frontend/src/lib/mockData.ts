import type {
  Consult, DoctorProfile, Fact, PatientProfile, ShareLink, Utterance,
} from '@/types';

export const mockDoctor: DoctorProfile = {
  userId: 'doc-001',
  fullName: 'Dr. Priya Verma',
  specialty: 'General Medicine',
  registrationNumber: 'MCI-2019-48291',
  clinicName: 'Verma Family Clinic',
};

export const mockPatient: PatientProfile = {
  userId: 'pat-001',
  fullName: 'Asha Sharma',
  dob: '1988-04-12',
  sex: 'F',
  bloodGroup: 'B+',
  openFlagCount: 1,
};

export const mockPatients: PatientProfile[] = [
  mockPatient,
  { userId: 'pat-002', fullName: 'Rajesh Kumar', dob: '1975-09-22', sex: 'M', bloodGroup: 'O+', openFlagCount: 0 },
  { userId: 'pat-003', fullName: 'Meera Patel', dob: '1992-01-05', sex: 'F', bloodGroup: 'A-', openFlagCount: 2 },
];

const utterances: Utterance[] = [
  { id: 'u1', consultId: 'c1', idx: 0, speakerId: '0', speakerRole: 'doctor', startSec: 0, endSec: 8, text: 'Asha ji, aaj kya taklif hai? Batayiye kab se hai.' },
  { id: 'u2', consultId: 'c1', idx: 1, speakerId: '1', speakerRole: 'patient', startSec: 9, endSec: 22, text: 'Doctor saab, teen din se bukhar aa raha hai aur gala bhi kharab hai. Khaana khane mein bahut takleef hoti hai.' },
  { id: 'u3', consultId: 'c1', idx: 2, speakerId: '0', speakerRole: 'doctor', startSec: 23, endSec: 35, text: 'Theek hai. Koi dawai le rahi hain abhi? Aur koi allergy hai kisi dawai se?' },
  { id: 'u4', consultId: 'c1', idx: 3, speakerId: '1', speakerRole: 'patient', startSec: 36, endSec: 50, text: 'Nahi koi dawai nahi le rahi. Haan, penicillin se mujhe rash ho jaata hai, pehle bhi hua tha.' },
  { id: 'u5', consultId: 'c1', idx: 4, speakerId: '0', speakerRole: 'doctor', startSec: 51, endSec: 68, text: 'Okay noted. Aapka BP check karte hain... 120/80 hai, normal hai. Temperature 101.2 hai. Main aapko amoxicillin likh rahi hoon, 500mg, din mein teen baar, paanch din ke liye.' },
  { id: 'u6', consultId: 'c1', idx: 5, speakerId: '0', speakerRole: 'doctor', startSec: 69, endSec: 84, text: 'Aur paracetamol bhi le lijiye bukhar ke liye. Agar teen din mein aaram nahi aaye toh wapas aa jaiyega. Paani zyada pijiye.' },
  { id: 'u7', consultId: 'c1', idx: 6, speakerId: '1', speakerRole: 'patient', startSec: 85, endSec: 92, text: 'Ji doctor. Main cigarette peeti hoon, koi problem toh nahi hai na?' },
  { id: 'u8', consultId: 'c1', idx: 7, speakerId: '0', speakerRole: 'doctor', startSec: 93, endSec: 105, text: 'Cigarette chhodna zaruri hai. Gale ki problem badhti hai isse. Follow up teen din baad kariyega.' },
];

const facts: Fact[] = [
  {
    id: 'f1', consultId: 'c1', patientId: 'pat-001', category: 'chief_complaint',
    text: 'Fever and sore throat for 3 days with difficulty eating',
    evidenceQuote: 'Teen din se bukhar aa raha hai aur gala bhi kharab hai',
    sourceUtteranceIdxArr: [1], riskTier: 1, confidence: 0.95,
    status: 'pending', individuallyReviewed: false, audioPlayed: false, editHistory: [],
  },
  {
    id: 'f2', consultId: 'c1', patientId: 'pat-001', category: 'social_history',
    text: 'Active smoker — cigarettes',
    evidenceQuote: 'Main cigarette peeti hoon',
    sourceUtteranceIdxArr: [6], riskTier: 1, confidence: 0.92,
    status: 'pending', individuallyReviewed: false, audioPlayed: false, editHistory: [],
  },
  {
    id: 'f3', consultId: 'c1', patientId: 'pat-001', category: 'past_history',
    text: 'Known penicillin allergy — rash',
    evidenceQuote: 'Penicillin se mujhe rash ho jaata hai, pehle bhi hua tha',
    sourceUtteranceIdxArr: [3], riskTier: 1, confidence: 0.98,
    status: 'pending', individuallyReviewed: false, audioPlayed: false, editHistory: [],
  },
  {
    id: 'f4', consultId: 'c1', patientId: 'pat-001', category: 'vital',
    text: 'BP 120/80 mmHg — normal. Temperature 101.2°F',
    evidenceQuote: 'Aapka BP check karte hain... 120/80 hai, normal hai. Temperature 101.2 hai',
    sourceUtteranceIdxArr: [4], riskTier: 2, confidence: 0.97,
    status: 'pending', individuallyReviewed: false, audioPlayed: false, editHistory: [],
  },
  {
    id: 'f5', consultId: 'c1', patientId: 'pat-001', category: 'exam_finding',
    text: 'Sore throat — difficulty swallowing',
    evidenceQuote: 'Gala bhi kharab hai. Khaana khane mein bahut takleef hoti hai',
    sourceUtteranceIdxArr: [1], riskTier: 2, confidence: 0.88,
    status: 'pending', individuallyReviewed: false, audioPlayed: false, editHistory: [],
  },
  {
    id: 'f6', consultId: 'c1', patientId: 'pat-001', category: 'follow_up',
    text: 'Follow up in 3 days if no improvement',
    evidenceQuote: 'Agar teen din mein aaram nahi aaye toh wapas aa jaiyega',
    sourceUtteranceIdxArr: [5], riskTier: 2, confidence: 0.91,
    status: 'pending', individuallyReviewed: false, audioPlayed: false, editHistory: [],
  },
  {
    id: 'f7', consultId: 'c1', patientId: 'pat-001', category: 'current_medication',
    text: 'Amoxicillin 500mg TID for 5 days',
    structuredPayload: { drug: 'Amoxicillin', dose: '500mg', frequency: 'TID (three times daily)', route: 'Oral', duration: '5 days' },
    evidenceQuote: 'Main aapko amoxicillin likh rahi hoon, 500mg, din mein teen baar, paanch din ke liye',
    sourceUtteranceIdxArr: [4], riskTier: 3, confidence: 0.96,
    status: 'pending', individuallyReviewed: false, audioPlayed: false, editHistory: [],
  },
  {
    id: 'f8', consultId: 'c1', patientId: 'pat-001', category: 'allergy',
    text: 'Penicillin allergy — causes rash',
    evidenceQuote: 'Penicillin se mujhe rash ho jaata hai',
    sourceUtteranceIdxArr: [3], riskTier: 3, confidence: 0.99,
    status: 'pending', individuallyReviewed: false, audioPlayed: false, editHistory: [],
  },
];

export const mockConsult: Consult = {
  id: 'c1',
  patientId: 'pat-001',
  doctorId: 'doc-001',
  status: 'in_review',
  audioDurationSec: 105,
  facts,
  utterances,
  startedAt: new Date().toISOString(),
};

export const mockFinalizedConsult: Consult = {
  id: 'c2',
  patientId: 'pat-001',
  doctorId: 'doc-001',
  status: 'finalized',
  audioDurationSec: 240,
  facts: facts.map(f => ({ ...f, id: `f2-${f.id}`, consultId: 'c2', status: 'approved' as const, individuallyReviewed: true, audioPlayed: true })),
  utterances: utterances.map(u => ({ ...u, id: `u2-${u.id}`, consultId: 'c2' })),
  startedAt: '2025-05-03T09:30:00Z',
  finalizedAt: '2025-05-03T10:15:00Z',
};

export const mockConsults: Consult[] = [mockConsult, mockFinalizedConsult];

export const mockShareLink: ShareLink = {
  id: 'share-001',
  token: 'abc123def456',
  grantedToPhone: undefined,
  expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
  revokedAt: undefined,
  accessLog: [
    { accessedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), phone: '+91 98765xxxxx' },
    { accessedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), phone: '+91 98765xxxxx' },
  ],
};

export const mockPatientFlags = [
  { id: 'flag-1', factId: 'f7', flagType: 'wrong' as const, note: 'Doctor said once a day, not twice', createdAt: new Date().toISOString() },
];
