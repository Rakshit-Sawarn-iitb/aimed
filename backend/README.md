# AIMED Backend

FastAPI backend for the AIMED medical consultation recorder. Handles authentication, audio transcription (Sarvam Saaras v3 with speaker diarization), and structured medical fact extraction.

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
cp .env.example .env   # then fill in SARVAM_API_KEY and ANTHROPIC_API_KEY

# Run DB migration (once)
python -c "
import psycopg2, pathlib
conn = psycopg2.connect(host='...', port=5432, dbname='postgres', user='postgres', password='...')
conn.autocommit = True
conn.cursor().execute(pathlib.Path('db/migrations/001_consults_schema.sql').read_text())
conn.close()
"

# Start dev server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Authentication

All protected routes require a Supabase JWT passed as a Bearer token:

```
Authorization: Bearer <access_token>
```

The `access_token` is returned by the login endpoints. The server verifies the token's signature using `JWT_SECRET` from `.env`.

---

## API Routes

### Health

#### `GET /health`
Check that the server is running.

- **Auth:** None
- **Input:** None
- **Response:**
```json
{ "status": "ok", "service": "aimed-backend" }
```

---

### Auth — `/auth`

#### `POST /auth/doctor/signup`
Register a new doctor account. Creates a Supabase Auth user and inserts a row into the `doctors` table.

- **Auth:** None
- **Request body:**
```json
{
  "phone": "+919876543210",
  "password": "securepassword",
  "name": "Dr. Priya Verma",
  "clinic_name": "Verma Clinic",
  "city": "Mumbai"
}
```
- **Response `200`:**
```json
{ "message": "Doctor account created", "user_id": "<uuid>" }
```
- **Errors:** `400` if Supabase signup fails.

---

#### `POST /auth/doctor/login`
Log in as a doctor. Verifies credentials with Supabase Auth and checks that a matching `doctors` row exists.

- **Auth:** None
- **Request body:**
```json
{
  "phone": "+919876543210",
  "password": "securepassword"
}
```
- **Response `200`:**
```json
{
  "access_token": "<jwt>",
  "refresh_token": "<jwt>",
  "role": "doctor",
  "user": {
    "id": "<uuid>",
    "name": "Dr. Priya Verma",
    "clinic_name": "Verma Clinic",
    "city": "Mumbai",
    "phone": "+919876543210"
  }
}
```
- **Errors:** `401` invalid credentials, `403` if account is not a doctor.

---

#### `POST /auth/patient/signup`
Register a new patient account. Creates a Supabase Auth user and inserts a row into the `patients` table.

- **Auth:** None
- **Request body:**
```json
{
  "phone": "+919876543211",
  "password": "securepassword",
  "name": "Asha Sharma",
  "age": 34,
  "blood_group": "O+"
}
```
- **Response `200`:**
```json
{ "message": "Patient account created", "user_id": "<uuid>" }
```
- **Errors:** `400` if signup fails.

---

#### `POST /auth/patient/login`
Log in as a patient.

- **Auth:** None
- **Request body:**
```json
{
  "phone": "+919876543211",
  "password": "securepassword"
}
```
- **Response `200`:**
```json
{
  "access_token": "<jwt>",
  "refresh_token": "<jwt>",
  "role": "patient",
  "user": {
    "id": "<uuid>",
    "name": "Asha Sharma",
    "age": 34,
    "phone": "+919876543211",
    "blood_group": "O+"
  }
}
```
- **Errors:** `401` invalid credentials, `403` if account is not a patient.

---

#### `POST /auth/logout`
Sign out the current user from Supabase Auth.

- **Auth:** None (session is cleared server-side)
- **Input:** None
- **Response `200`:**
```json
{ "message": "Logged out" }
```

---

### Consults — `/consults`

All consult routes require a valid **doctor** JWT.

### The Complete Consultation Flow

To successfully process an audio recording of a medical consultation, the frontend must execute the following sequence:

1. **Start the Consult:** `POST /consults`
   - Create a new consult row for the patient.
   - The backend returns a `consult_id` and a signed `upload_url`.

2. **Upload the Audio:** `PUT <upload_url>`
   - The frontend directly uploads the raw audio file (e.g., `.webm`, `.m4a`) to Supabase Storage using the signed `upload_url`. This bypasses the backend to handle large files efficiently. *(Note: This is a direct HTTP PUT request to Supabase, not a backend API).*

3. **Finalize & Trigger Pipeline:** `POST /consults/{consult_id}/finalize`
   - Tell the backend that the audio has been successfully uploaded.
   - The backend will kick off the background worker to transcode the audio to `.wav`, send it to Sarvam AI for transcription and diarization, and prepare the utterances.

4. **Poll for Progress:** `GET /consults/{consult_id}/status`
   - The frontend should poll this endpoint every 3–5 seconds to check the processing status.
   - Wait until the `status` becomes `"in_review"`. (If it becomes `"failed"`, check the `sarvam_error`).

5. **Fetch Results:** `GET /consults/{consult_id}`
   - Once the status is `"in_review"`, call this to retrieve the full, diarized transcript (a list of sentences spoken by the "doctor" vs "patient").

#### `POST /consults`
Create a new consult session for a patient. Returns a signed Supabase Storage URL (valid 30 min) that the frontend uses to PUT the recorded audio directly.

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
| `idempotency_key` | string (UUID) | ❌ | Pass a stable UUID per Record button press to prevent duplicate rows on retry |

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
Tell the server the audio upload is complete and start the transcription pipeline as a background task. Returns `202 Accepted` immediately — transcription runs in the background.

**Pipeline triggered:**
1. Download raw audio from Supabase Storage
2. Transcode to 16 kHz mono WAV (ffmpeg)
3. Submit to Sarvam Saaras v3 (`codemix`, `with_diarization=True`, `num_speakers=2`)
4. Poll until complete, parse diarized JSON
5. Label speakers (doctor vs patient via first-speaker heuristic)
6. Persist utterances to `utterances` table
7. Update consult status → `extracting` (Claude extraction runs next)

- **Auth:** Doctor JWT required
- **Path param:** `consult_id` — UUID from `POST /consults`
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
| `doctor_speaker_id` | `"0"` or `"1"` | ❌ | If the doctor knows which Sarvam speaker they are, pass it to skip the heuristic |

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
Lightweight polling endpoint. Returns just the status, any error, and utterance count. Poll this every 3–5 seconds until `status` is `in_review` or `failed`.

- **Auth:** Doctor JWT required
- **Path param:** `consult_id`
- **Input:** None
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
| `extracting` | Sarvam done, Claude extraction running (next step) |
| `in_review` | Facts extracted, doctor needs to review |
| `finalized` | Doctor approved, record is frozen |
| `failed` | Something went wrong — check `sarvam_error` |

---

#### `GET /consults/{consult_id}`
Full consult detail including all diarized utterances and the speaker map. Available once `status` is `extracting` or later.

- **Auth:** Doctor JWT required
- **Path param:** `consult_id`
- **Input:** None
- **Response `200`:**
```json
{
  "id": "<uuid>",
  "patient_id": "<uuid>",
  "doctor_id": "<uuid>",
  "status": "in_review",
  "audio_object_key": "raw/<consult_id>",
  "sarvam_job_id": null,
  "sarvam_error": null,
  "transcript_hash": "sha256...",
  "extraction_model": null,
  "started_at": "2026-05-05T13:00:00Z",
  "finalized_at": null,
  "created_at": "2026-05-05T13:00:00Z",
  "utterances": [
    {
      "idx": 0,
      "speaker_id": "0",
      "speaker_role": "doctor",
      "text": "Namaste, aap ko kya problem hai?",
      "start_sec": 0.01,
      "end_sec": 3.5
    },
    {
      "idx": 1,
      "speaker_id": "1",
      "speaker_role": "patient",
      "text": "Sir, mujhe 3 din se bukhaar hai.",
      "start_sec": 3.8,
      "end_sec": 6.2
    }
  ],
  "speaker_map": {
    "doctor_speaker_id": "0",
    "patient_speaker_id": "1",
    "method": "first_speaker",
    "confidence": 0.75
  }
}
```
- **Errors:** `404` not found, `403` not your consult.

---

#### `PATCH /consults/{consult_id}/speaker`
Correct the speaker labels if the heuristic got them wrong. Re-labels all utterances in the consult and updates `transcript_json`. Only allowed while `status` is `in_review` or `extracting`.

- **Auth:** Doctor JWT required
- **Path param:** `consult_id`
- **Request body:**
```json
{
  "doctor_speaker_id": "1"
}
```
| Field | Type | Required | Description |
|---|---|---|---|
| `doctor_speaker_id` | `"0"` or `"1"` | ✅ | The Sarvam speaker ID that is actually the doctor |

- **Response `200`:**
```json
{
  "consult_id": "<uuid>",
  "doctor_speaker_id": "1",
  "patient_speaker_id": "0",
  "updated_utterances": 42
}
```
- **Errors:** `404` not found, `403` not your consult, `409` not in a reviewable status.

---

### Reports — `/reports`

#### `GET /reports/`
Fetch all reports belonging to the authenticated doctor. (Placeholder route — full implementation coming with Claude extraction.)

- **Auth:** Doctor JWT required
- **Input:** None
- **Response `200`:** Array of report rows from the `reports` table.

---

## Project Structure

```
backend/
├── main.py                        # FastAPI app factory + router registration
├── requirements.txt
├── .env                           # Secrets (not committed)
│
├── api/
│   ├── auth.py                    # /auth/* — signup, login, logout
│   ├── consults.py                # /consults/* — consult lifecycle + transcription
│   └── reports.py                 # /reports/ — placeholder
│
├── core/
│   ├── config.py                  # pydantic-settings (reads .env)
│   └── auth.py                    # JWT verification dependency
│
├── db/
│   ├── session.py                 # Supabase client factory
│   └── migrations/
│       └── 001_consults_schema.sql  # consults, utterances, facts, audit_log tables
│
├── models/
│   ├── consult.py                 # Pydantic request/response schemas for consults
│   ├── patient.py                 # Patient dataclass
│   ├── doctor.py                  # Doctor dataclass
│   ├── job.py                     # ProcessingJob dataclass + JobStatus enum
│   └── report.py                  # Report dataclass
│
├── services/
│   ├── audio_pipeline.py          # ffmpeg transcode + Supabase Storage I/O
│   ├── sarvam_client.py           # Sarvam Saaras v3 job submit/poll/parse
│   └── speaker_labeling.py        # Doctor vs patient speaker assignment
│
└── workers/
    └── transcription_worker.py    # Background task orchestrating the full pipeline
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) |
| `SUPABASE_DATABASE_URI` | Full Postgres connection string (URL-encode `@` in password as `%40`) |
| `JWT_SECRET` | Supabase JWT secret for token verification |
| `SARVAM_API_KEY` | Sarvam AI subscription key |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key (for fact extraction — coming next) |