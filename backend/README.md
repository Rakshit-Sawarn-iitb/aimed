# AIMED Backend

FastAPI backend for the AIMED medical consultation recorder. Handles OTP authentication, audio transcription (Sarvam Saaras v3 with speaker diarization), AI-powered SOAP note generation (Claude 4.6), structured fact extraction, drug interaction checks, and WhatsApp patient notifications.

**Base URL (local dev):** `http://localhost:8000`  
**Interactive docs:** `http://localhost:8000/docs`  
**Redoc:** `http://localhost:8000/redoc`

---

## System Requirements

This project requires **FFmpeg** to be installed on your system to process audio files before sending them to Sarvam AI.
- **Windows:** Run `winget install FFmpeg` (you must restart your IDE/terminal after).
- **Mac:** Run `brew install ffmpeg`
- **Linux:** Run `sudo apt install ffmpeg`

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Add your API keys to .env
cp .env.example .env   # then fill in all required keys

# Start dev server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Authentication

All protected routes require a Supabase JWT passed as a Bearer token:

```
Authorization: Bearer <access_token>
```

Authentication uses **phone-based OTP** (no passwords). The flow:

1. `POST /auth/otp/start` — send an SMS OTP to the user's phone
2. `POST /auth/otp/verify` — verify the OTP, receive `access_token` + `refresh_token`
3. If `is_new: true`, the user needs to complete their profile:
   - Doctors → `POST /auth/doctor/complete-profile`
   - Patients → `POST /auth/patient/complete-profile`
4. When the access token expires, exchange the refresh token via `POST /auth/refresh` (the frontend does this automatically on 401).

---

## API Routes

### Health

#### `GET /health`
Check that the server is running.

- **Auth:** None
- **Response:**
```json
{ "status": "ok", "service": "aimed-backend" }
```

---

### Auth — `/auth`

#### `POST /auth/otp/start`
Send an SMS OTP to the given phone number. Creates a Supabase Auth user on first use.

- **Auth:** None
- **Request body:**
```json
{ "phone": "+919876543210" }
```
- **Response `200`:**
```json
{ "message": "OTP sent" }
```
- **Errors:** `400` if Supabase rejects the phone number.

---

#### `POST /auth/otp/verify`
Verify the OTP and exchange it for a session. Returns tokens and the user's role+profile if onboarding was previously completed.

- **Auth:** None
- **Request body:**
```json
{
  "phone": "+919876543210",
  "token": "123456"
}
```
- **Response `200`:**
```json
{
  "access_token": "<jwt>",
  "refresh_token": "<jwt>",
  "is_new": false,
  "role": "doctor",
  "user": {
    "id": "<uuid>",
    "phone": "+919876543210",
    "name": "Dr. Priya Verma",
    "clinic_name": "Verma Clinic",
    "city": "Mumbai"
  }
}
```
- `is_new: true` means the user verified for the first time and has no profile yet — redirect to onboarding.
- **Errors:** `401` invalid OTP.

---

#### `POST /auth/doctor/complete-profile`
First-time doctor onboarding. Inserts a row into the `doctors` table.

- **Auth:** JWT required (from `/auth/otp/verify`)
- **Request body:**
```json
{
  "name": "Dr. Priya Verma",
  "clinic_name": "Verma Clinic",
  "city": "Mumbai"
}
```
- **Response `200`:**
```json
{
  "role": "doctor",
  "user": { "id": "<uuid>", "phone": "+91...", "name": "...", "clinic_name": "...", "city": "..." }
}
```
- **Errors:** `409` if a profile already exists for this user.

---

#### `POST /auth/patient/complete-profile`
First-time patient onboarding. Inserts a row into the `patients` table.

- **Auth:** JWT required (from `/auth/otp/verify`)
- **Request body:**
```json
{
  "name": "Asha Sharma",
  "age": 34,
  "blood_group": "O+"
}
```
- **Response `200`:**
```json
{
  "role": "patient",
  "user": { "id": "<uuid>", "phone": "+91...", "name": "...", "age": 34, "blood_group": "O+" }
}
```
- **Errors:** `409` if a profile already exists.

---

#### `GET /auth/me`
Return the authenticated user's role and profile. Used on app load to restore session state.

- **Auth:** JWT required
- **Response `200`:**
```json
{
  "id": "<uuid>",
  "phone": "+919876543210",
  "role": "doctor",
  "is_new": false,
  "profile": { "name": "Dr. Priya Verma", "clinic_name": "Verma Clinic", "city": "Mumbai" }
}
```

---

#### `POST /auth/refresh`
Exchange a Supabase refresh token for a new access + refresh token pair. Calls the GoTrue HTTP endpoint directly, so behaviour is supabase-py-version-independent.

- **Auth:** None
- **Request body:**
```json
{ "refresh_token": "<refresh_jwt>" }
```
- **Response `200`:**
```json
{
  "access_token": "<new_jwt>",
  "refresh_token": "<new_refresh_jwt>"
}
```
- **Errors:** `401` if the refresh token is expired or invalid.

---

#### `POST /auth/logout`
Sign out the current user from Supabase Auth.

- **Auth:** None
- **Response `200`:**
```json
{ "message": "Logged out" }
```

---

### Consults — `/consults`

All consult routes require a valid **doctor** JWT.

### The Complete Consultation Flow

```
POST /consults              → create row, get signed upload URL
PUT  <upload_url>           → upload raw audio directly to Supabase Storage (not a backend call)
POST /consults/{id}/finalize → trigger transcription + extraction pipeline (async)
GET  /consults/{id}/status   → poll every 3-5 s until status = "in_review"
GET  /consults/{id}          → full detail: utterances + SOAP report + facts
PATCH /consults/{id}/speaker → (optional) correct speaker labels → re-runs SOAP
POST /consults/{id}/approve  → doctor approves → status = "finalized", WhatsApp sent
```

#### `GET /consults`
Return all consults for the authenticated doctor, newest first. Patient names are batch-fetched.

- **Auth:** Doctor JWT required
- **Response `200`:** Array of:
```json
{
  "id": "<uuid>",
  "patient_id": "<uuid>",
  "patient_name": "Asha Sharma",
  "status": "in_review",
  "created_at": "2026-05-05T13:00:00Z",
  "finalized_at": null,
  "sarvam_error": null
}
```

---

#### `POST /consults`
Create a new consult session for a patient. Returns a signed Supabase Storage URL (valid 30 min) for the frontend to PUT raw audio directly.

- **Auth:** Doctor JWT required
- **Request body:**
```json
{
  "patient_id": "<patient-uuid>",
  "idempotency_key": "<optional-client-uuid>"
}
```
| Field | Type | Required | Description |
|---|---|---|---|
| `patient_id` | string (UUID) | ✅ | The patient this consult is for |
| `idempotency_key` | string (UUID) | ❌ | Pass a stable UUID per recording session to prevent duplicate rows on retry |

- **Response `201`:**
```json
{
  "consult_id": "<uuid>",
  "upload_url": "https://...supabase.co/storage/v1/object/sign/...",
  "message": "Consult created. Upload audio to upload_url, then call /finalize."
}
```

---

#### `POST /consults/{consult_id}/finalize`
Tell the server the audio upload is complete and start the transcription + extraction pipeline as a background task. Returns `202 Accepted` immediately.

**Pipeline steps:**
1. Download raw audio from Supabase Storage
2. Transcode to 16 kHz mono WAV (ffmpeg)
3. Submit to Sarvam Saaras v3 (codemix, with diarization, 2 speakers)
4. Poll until complete; parse diarized JSON
5. Label speakers (doctor vs patient via first-speaker heuristic)
6. Persist utterances to `utterances` table
7. Run SOAP extraction (Gemini 2.5 Flash) → `reports` table
8. Run NER + RxNorm drug interaction checks
9. Persist structured facts to `facts` table
10. Update consult status → `in_review`

- **Auth:** Doctor JWT required
- **Request body:**
```json
{
  "audio_object_key": "raw/<consult_id>",
  "doctor_speaker_id": "0"
}
```
| Field | Type | Required | Description |
|---|---|---|---|
| `audio_object_key` | string | ✅ | The Supabase Storage object key where the audio was uploaded |
| `doctor_speaker_id` | `"0"` or `"1"` | ❌ | Explicit speaker ID; skips first-speaker heuristic if provided |

- **Response `202`:**
```json
{
  "consult_id": "<uuid>",
  "status": "uploaded",
  "message": "Transcription pipeline started. Poll /consults/{id}/status for updates."
}
```
- **Errors:** `404` consult not found, `403` not your consult, `409` already processing.

---

#### `GET /consults/{consult_id}/status`
Lightweight polling endpoint. Poll every 3–5 seconds until `status` is `in_review` or `failed`.

- **Auth:** Doctor JWT required
- **Response `200`:**
```json
{
  "consult_id": "<uuid>",
  "status": "transcribing",
  "sarvam_error": null,
  "utterance_count": 0
}
```

**Possible `status` values:**

| Status | Meaning |
|---|---|
| `recording` | Consult created, audio not yet uploaded |
| `uploaded` | Audio uploaded, pipeline about to start |
| `transcribing` | Sarvam job running |
| `extracting` | Transcription done, SOAP + fact extraction running |
| `in_review` | Everything extracted, doctor needs to review |
| `finalized` | Doctor approved; record is frozen |
| `failed` | Something went wrong — check `sarvam_error` |

---

#### `GET /consults/{consult_id}`
Full consult detail including diarized utterances, speaker map, and SOAP report. Available once `status` is `in_review` or later.

- **Auth:** Doctor JWT required
- **Response `200`:**
```json
{
  "id": "<uuid>",
  "patient_id": "<uuid>",
  "doctor_id": "<uuid>",
  "status": "in_review",
  "utterances": [
    {
      "idx": 0,
      "speaker_id": "0",
      "speaker_role": "doctor",
      "text": "Namaste, aap ko kya problem hai?",
      "start_sec": 0.01,
      "end_sec": 3.5
    }
  ],
  "speaker_map": {
    "doctor_speaker_id": "0",
    "patient_speaker_id": "1",
    "method": "first_speaker",
    "confidence": 0.75
  },
  "report": {
    "soap_subjective": "...",
    "soap_objective": "...",
    "soap_assessment": "...",
    "soap_plan": "...",
    "drug_interactions": [],
    "missing_fields": [],
    "followup_questions": ["..."],
    "plain_language_summary": "..."
  }
}
```
- **Errors:** `404` not found, `403` not your consult.

---

#### `PATCH /consults/{consult_id}/speaker`
Correct speaker labels if the heuristic got them wrong. Re-labels all utterances and queues a SOAP re-extraction in the background because the existing SOAP note was generated with wrong speaker roles. Only allowed while `status` is `in_review` or `extracting`.

- **Auth:** Doctor JWT required
- **Request body:**
```json
{ "doctor_speaker_id": "1" }
```
- **Response `200`:**
```json
{
  "consult_id": "<uuid>",
  "doctor_speaker_id": "1",
  "patient_speaker_id": "0",
  "updated_utterances": 42,
  "message": "Speaker labels updated. SOAP note is being regenerated."
}
```

---

#### `POST /consults/{consult_id}/approve`
Doctor approves the SOAP note. Transitions status from `in_review` → `finalized` and sends the patient a WhatsApp visit summary via Twilio.

Blocked if any **Tier-3** (high-risk) facts are still in `pending` status — the doctor must individually review those first.

- **Auth:** Doctor JWT required
- **Response `200`:**
```json
{
  "consult_id": "<uuid>",
  "status": "finalized",
  "finalized_at": "2026-05-05T14:30:00Z"
}
```
- **Errors:** `409` if status ≠ `in_review`, or if Tier-3 facts are unreviewed.

---

### Facts — `/consults/{id}/facts` and `/facts`

#### `GET /consults/{consult_id}/facts`
Return all structured facts for a consult, ordered by risk tier (descending) then category. Each fact includes audio seek timestamps derived from its source utterances.

- **Auth:** Doctor JWT required
- **Response `200`:** Array of:
```json
{
  "id": "<uuid>",
  "category": "medication",
  "text": "Paracetamol 500mg twice daily",
  "structured_payload": {},
  "evidence_quote": "doctor said take paracetamol...",
  "source_utterance_idx_arr": [4, 5],
  "risk_tier": 2,
  "risk_reason": "Potential interaction with existing medication",
  "confidence": 0.92,
  "status": "pending",
  "individually_reviewed": false,
  "audio_played": false,
  "reviewed_at": null,
  "edit_history": [],
  "start_sec": 12.4,
  "end_sec": 18.7
}
```

---

#### `PATCH /facts/{fact_id}`
Approve, reject, or edit a single fact. Appends to `edit_history` and marks `individually_reviewed`.

- **Auth:** Doctor JWT required
- **Request body:**
```json
{
  "action": "approved",
  "edited_value": null,
  "audio_played": true
}
```
| Field | Type | Required | Description |
|---|---|---|---|
| `action` | `"approved"` \| `"rejected"` \| `"edited"` | ✅ | What the doctor decided |
| `edited_value` | object | ❌ | If `action = "edited"`, replaces `structured_payload` |
| `audio_played` | boolean | ❌ | Mark that the doctor listened to the audio clip |

- **Response `200`:**
```json
{ "fact_id": "<uuid>", "status": "approved" }
```

---

#### `GET /consults/{consult_id}/audio-url`
Return a 1-hour signed URL for the raw audio file so the frontend can play it and seek to specific fact timestamps.

- **Auth:** Doctor JWT required
- **Response `200`:**
```json
{
  "url": "https://...supabase.co/...",
  "audio_object_key": "raw/<consult_id>",
  "duration_sec": 183.4,
  "expires_in": 3600
}
```

---

### Patients — `/patients`

All patient routes require a valid **doctor** JWT.

#### `GET /patients`
Return all unique patients the doctor has consulted, with last-seen date and total consult count, sorted newest-first.

- **Response `200`:** Array of:
```json
{
  "id": "<uuid>",
  "name": "Asha Sharma",
  "phone": "+919876543211",
  "last_seen": "2026-05-05T13:00:00Z",
  "consult_count": 3
}
```

---

#### `GET /patients/{patient_id}`
Return the patient's profile plus their full consult history with this doctor. For finalized consults, includes the SOAP report summary. Reports are batch-fetched in a single query.

- **Response `200`:**
```json
{
  "patient": {
    "id": "<uuid>",
    "name": "Asha Sharma",
    "phone": "+919876543211",
    "age": 34,
    "blood_group": "O+"
  },
  "consults": [
    {
      "id": "<uuid>",
      "status": "finalized",
      "created_at": "2026-05-05T13:00:00Z",
      "finalized_at": "2026-05-05T14:30:00Z",
      "report": {
        "soap_subjective": "...",
        "soap_objective": "...",
        "soap_assessment": "...",
        "soap_plan": "...",
        "plain_language_summary": "...",
        "followup_questions": ["..."],
        "drug_interactions": []
      }
    }
  ]
}
```
- **Errors:** `404` patient not found.

---

#### `GET /patients/by-phone/{phone}`
Find a patient by their 10-digit mobile number. Tries exact match, then with the `+91` country code prefix.

- **Path param:** `phone` — 10-digit number (without country code), e.g. `9876543211`
- **Response `200`:**
```json
{
  "id": "<uuid>",
  "name": "Asha Sharma",
  "age": 34,
  "blood_group": "O+",
  "phone": "+919876543211"
}
```
- **Errors:** `404` no patient found.

> **Route ordering note:** `/patients/by-phone/{phone}` is registered before `/{patient_id}` to prevent the literal segment "by-phone" being consumed as a UUID.

---

## Project Structure

```
backend/
├── main.py                        # FastAPI app factory + router registration
├── requirements.txt
├── .env                           # Secrets (not committed)
│
├── api/
│   ├── auth.py                    # /auth/* — OTP, profile completion, refresh, me, logout
│   ├── consults.py                # /consults/* — full consult lifecycle + approve
│   ├── facts.py                   # /consults/{id}/facts, /facts/{id}, /consults/{id}/audio-url
│   ├── patients.py                # /patients/* — list, get by id, get by phone
│   └── reports.py                 # /reports/ — placeholder
│
├── core/
│   ├── config.py                  # pydantic-settings (reads .env)
│   ├── auth.py                    # JWT verification dependency
│   └── llm.py                     # Gemini LLM client wrapper (round-robins API keys)
│
├── db/
│   ├── base.py                    # Supabase client helpers
│   ├── session.py                 # get_supabase / get_supabase_admin factories
│   └── migrations/
│       └── 001_consults_schema.sql  # consults, utterances, facts, reports, audit_log tables
│
├── models/
│   ├── consult.py                 # Pydantic request/response schemas for consults + facts
│   ├── patient.py                 # Patient dataclass
│   ├── doctor.py                  # Doctor dataclass
│   ├── job.py                     # ProcessingJob dataclass + JobStatus enum
│   └── report.py                  # Report dataclass
│
├── prompts/
│   └── SOAP_PROMPT.txt            # System prompt for SOAP extraction (Gemini)
│
├── services/
│   ├── audio_pipeline.py          # ffmpeg transcode + Supabase Storage I/O
│   ├── facts_extractor.py         # Structured fact extraction from transcript (LLM)
│   ├── ner.py                     # Named entity recognition (medications, dosages, etc.)
│   ├── rxnorm.py                  # RxNorm API drug interaction checks
│   ├── sarvam_client.py           # Sarvam Saaras v3 job submit/poll/parse
│   ├── soap.py                    # SOAP note generation via Gemini (orchestrates NER + RxNorm)
│   ├── speaker_labeling.py        # Doctor vs patient speaker assignment heuristic
│   └── whatsapp.py                # Twilio WhatsApp visit summary notifications
│
└── workers/
    └── transcription_worker.py    # Background task: orchestrates the full pipeline end-to-end
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (bypasses RLS) |
| `SUPABASE_DATABASE_URI` | ✅ | Full Postgres connection string (URL-encode special chars) |
| `JWT_SECRET` | ✅ | Supabase JWT secret for token signature verification |
| `SARVAM_API_KEY` | ✅ | Sarvam AI subscription key for speech transcription |
| `GEMINI_API_KEY_1` | ✅ | Gemini API key (primary) for SOAP + fact extraction |
| `GEMINI_API_KEY_2` | ❌ | Gemini API key (secondary) — round-robined with key 1 for throughput |
| `ANTHROPIC_API_KEY` | ❌ | Anthropic Claude API key (legacy; Gemini is primary extractor) |
| `TWILIO_ACCOUNT_SID` | ❌ | Twilio account SID for WhatsApp notifications |
| `TWILIO_AUTH_TOKEN` | ❌ | Twilio auth token |
| `TWILIO_WHATSAPP_FROM` | ❌ | Twilio WhatsApp sender number, e.g. `+14155238886` |
