# AIMED Frontend

React + TypeScript frontend for the AIMED medical consultation recorder. Doctors record consultations via phone, the app transcribes them with speaker diarization, generates SOAP notes with AI, and lets doctors review, correct, and finalize the record. Patients can view their shared records. On finalization, a plain-language summary is sent to the patient via WhatsApp.

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React 18 + TypeScript 5 |
| Build tool | Vite 5 |
| Routing | React Router DOM v6 |
| Styling | Tailwind CSS |
| UI components | shadcn/ui (Radix UI primitives) |
| Icons | Lucide React |
| Date utilities | date-fns |
| Toast notifications | Sonner |
| Server state | TanStack Query (React Query) |
| Validation | Zod |

---

## Quick Start

```bash
npm install
cp .env.example .env.local   # set VITE_API_BASE_URL
npm run dev
```

The app runs at `http://localhost:5173`.

---

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend base URL, e.g. `http://localhost:8000`. Defaults to `http://localhost:8000` if unset. |

---

## Project Structure

```
frontend/src/
│
├── App.tsx                         # Root — React Query provider + all routes
│
├── lib/
│   ├── api.ts                      # Typed fetch wrapper with JWT auth + automatic token refresh
│   └── utils.ts                    # cn() tailwind class merger
│
├── hooks/
│   └── useMe.ts                    # Fetch /auth/me; exposes me, loading, logout
│
├── types/
│   └── index.ts                    # Shared TypeScript types (ConsultListItem, ConsultStatus, etc.)
│
├── pages/
│   ├── Login.tsx                   # OTP login (phone → OTP → session)
│   ├── Onboarding.tsx              # Profile completion for new users (doctor or patient)
│   ├── DoctorDashboard.tsx         # Doctor home: week calendar strip + day-filtered consult list
│   ├── PatientList.tsx             # All patients the doctor has consulted (searchable)
│   ├── PatientRecord.tsx           # Longitudinal patient view: profile + consult timeline
│   ├── NewConsult.tsx              # Full consult flow: record → upload → review → approve
│   ├── PatientHome.tsx             # Patient home: list of their own consults
│   ├── PatientShares.tsx           # Patient: view consults shared with them
│   ├── SharedRecord.tsx            # Public share link view (no auth required)
│   └── NotFound.tsx                # 404
│
├── components/
│   ├── layout/
│   │   ├── DoctorLayout.tsx        # h-screen shell: NavBar + sidebar + <Outlet>
│   │   ├── PatientLayout.tsx       # h-screen shell: NavBar + <Outlet>
│   │   ├── NavBar.tsx              # Top bar: logo, notifications bell, user avatar menu (logout)
│   │   ├── Sidebar.tsx             # Desktop left sidebar (doctor nav links)
│   │   └── BottomTabBar.tsx        # Mobile bottom tab bar (doctor or patient variant)
│   │
│   ├── consult/
│   │   ├── Recorder.tsx            # MediaRecorder wrapper with live waveform
│   │   ├── ProcessingStepper.tsx   # Animated pipeline progress (transcribing → extracting → ready)
│   │   ├── TranscriptViewer.tsx    # Scrollable diarized transcript (doctor/patient colour-coded)
│   │   ├── FactPanel.tsx           # Extracted facts list with risk-tier badges + review actions
│   │   ├── FactCard.tsx            # Single fact card: text, evidence quote, audio seek button
│   │   ├── ReviewBottomBar.tsx     # Sticky bottom bar with "Approve" button + Tier-3 guard
│   │   ├── AudioAnchor.tsx         # Inline audio playback seeking to a specific fact timestamp
│   │   └── FinalizedView.tsx       # Read-only SOAP note view for finalized consults
│   │
│   ├── shared/
│   │   ├── RequireAuth.tsx         # Route guard: checks localStorage role vs required role
│   │   ├── StatusBadge.tsx         # Coloured pill badge for consult status
│   │   ├── TierBadge.tsx           # Risk-tier badge (Tier 1/2/3)
│   │   ├── OtpInput.tsx            # 6-digit OTP input with auto-focus + auto-submit
│   │   └── SkeletonCard.tsx        # Animated loading skeleton
│   │
│   ├── patient/
│   │   ├── ConsultTimeline.tsx     # Patient-side timeline of consults
│   │   ├── AuditBadge.tsx          # Audit status indicator
│   │   └── FlagSheet.tsx           # Flag / concern sheet for patients
│   │
│   └── ui/                         # shadcn/ui primitives (button, dialog, badge, etc.)
│
└── NavLink.tsx                     # Wrapper for sidebar nav links with active state
```

---

## Authentication Flow

Authentication uses **phone-based OTP** — no passwords.

```
/login page
  1. User enters phone number
  2. POST /auth/otp/start  → backend sends SMS OTP
  3. User enters 6-digit OTP
  4. POST /auth/otp/verify → { access_token, refresh_token, is_new, role }

  If is_new === true  → navigate to /onboarding (complete profile)
  If role === "doctor" → navigate to /doctor
  If role === "patient"→ navigate to /patient
```

**Onboarding** (`/onboarding`): new users pick a role (doctor or patient) and fill in their profile. On submit, calls `POST /auth/doctor/complete-profile` or `POST /auth/patient/complete-profile`.

**Session storage:** tokens are kept in `localStorage` under the keys `aimed_access_token`, `aimed_refresh_token`, and `aimed_role`. The `auth` object in `src/lib/api.ts` is the single source of truth for reading/writing these.

**Route protection:** `RequireAuth` checks `localStorage` for the correct role and redirects to `/login` if absent.

---

## API Client (`src/lib/api.ts`)

All backend calls go through `api.get / post / patch / delete`, which:

1. Attaches `Authorization: Bearer <access_token>` from localStorage.
2. On **401**, automatically attempts a token refresh via `POST /auth/refresh`.
3. Retries the original request with the new token.
4. If the retry also fails with 401, clears localStorage and redirects to `/login`.

**Thundering-herd protection:** a module-level `_refreshPromise` ensures that if multiple concurrent requests all get 401 at the same time, only one refresh call is made — all others queue on the same promise.

```typescript
// Usage
import { api } from '@/lib/api';
const consults = await api.get<ConsultListItem[]>('/consults');
const result   = await api.post('/consults', { patient_id, idempotency_key });
```

---

## Pages

### `/login` — Login
Phone number entry → OTP verification. After successful verify, routes the user based on `role` from the response. Includes a testing credentials box at the bottom for quick developer access (e.g., Doctor: 9999999999, Patient: 1111111111). Features the AIMED logo and branding.

### `/onboarding` — Onboarding
New users select doctor or patient, fill in their profile (name, clinic for doctors; name, age, blood group for patients), and are routed to their home.

### `/doctor` — Doctor Dashboard
- Week calendar strip: Mon–Sun of the selected week with per-day consult count badges. Arrow buttons navigate backward in time (future days are disabled). A "Today" shortcut reappears when browsing past weeks.
- Day-filtered consult list: clicking a day shows only consults created that day.
- Filter tabs: All | Needs review | Finalized | Failed — only tabs with results are shown.
- Left-border accent per status: orange (in_review), green (finalized), red (failed).
- Fixed header (calendar + tabs never scroll); only the consult list scrolls.
- "New consult" button navigates to `/doctor/consult/new`.

### `/doctor/patients` — Patient List
All patients the doctor has ever consulted. Live search by name or phone. Shows last-seen date and total consult count. Clicking a row navigates to the patient's longitudinal record.

### `/doctor/patients/:patientId` — Patient Record
Longitudinal view of a single patient:
- Profile card: name, phone, age, blood group, total consult count.
- Consult timeline sorted newest-first.
- Finalized consults: click to expand inline SOAP summary (Subjective / Objective / Assessment / Plan + follow-up + patient-friendly summary). "View full consult →" navigates to the review view.
- In-review consults: click navigates directly to the review flow.

### `/doctor/consult/new` — New Consult
### `/doctor/consult/:consultId` — Existing Consult
Both routes render `NewConsult.tsx`, a multi-phase state machine:

| Phase | UI |
|---|---|
| `idle` | Phone search to find patient (automatically prefixes `91` to the 10-digit input), then "Start recording" |
| `loading` | Spinner (shown when navigating directly to an existing consult URL) |
| `recording` | Live waveform recorder + stop button |
| `uploading` | Progress indicator while audio is PUT to Supabase Storage |
| `processing` | `ProcessingStepper` polling `GET /consults/{id}/status` every 3 s |
| `review` | Two-panel layout: `TranscriptViewer` (left) + `FactPanel` (right) |
| `failed` | Error message + retry option |

When a finalized consult is loaded, `FinalizedView` is rendered instead — a full read-only SOAP note.

**Speaker correction:** in the review phase, the doctor can flip which speaker is "doctor" vs "patient". This calls `PATCH /consults/{id}/speaker`, which re-runs SOAP extraction in the background and returns the consult to `in_review` when done.

**Approve:** the "Approve" button calls `POST /consults/{id}/approve`. Tier-3 (high-risk) facts must all be individually reviewed first or the backend rejects with 409. On success, a WhatsApp summary is sent to the patient.

### `/patient` — Patient Home
Patient-facing view of their own finalized consults, fetched via `GET /patients/me/consults`. Displays consult cards with the doctor's name, date, and a visit summary snippet. Clicking a card opens a `Dialog` modal that reveals the full clinical picture exactly as the doctor sees it (Subjective, Objective, Assessment, Plan, Follow-up Questions, and Patient-friendly summary).

### `/patient/shares` — Patient Shares
Consults shared with the patient via a share token.

### `/shared/:token` — Shared Record
Public, unauthenticated view of a shared consult record.

---

## Key Components

### `FinalizedView`
Read-only SOAP display for a finalized consult. Sections: Subjective, Objective, Assessment, Plan (with `whitespace-pre-wrap`), followed by drug interactions (tier-3 styling), follow-up questions (tier-2 styling), and the plain-language patient summary (tier-1 styling). Used both in `NewConsult` (when navigating to a finalized consult) and can be embedded in `PatientRecord`.

### `FactPanel` + `FactCard`
Structured facts extracted by the AI, grouped by risk tier. Each card shows the fact text, evidence quote from the transcript, a risk badge, and an audio seek button that loads `GET /consults/{id}/audio-url` and seeks `HTMLAudioElement` to `fact.start_sec`. Doctors can approve, reject, or edit facts individually.

### `ProcessingStepper`
Animated multi-step progress indicator that maps backend `status` values to human-readable steps. Polls `GET /consults/{id}/status` every 3 seconds.

### `NavBar`
Top bar across all authenticated views. Displays the AIMED logo and name. User avatar opens a dropdown (click-outside to close) showing the signed-in name and a Log out button. Logout calls `POST /auth/logout`, clears localStorage, and redirects to `/login`.

### `StatusBadge`
Coloured pill that maps `ConsultStatus` → label + colour:
- `in_review` → amber "Needs review"
- `finalized` → green "Finalized"
- `failed` → red "Failed"
- others → grey

---

## Layout System

Both `DoctorLayout` and `PatientLayout` use `h-screen flex flex-col overflow-hidden` to pin the viewport — content never grows the page taller than the screen. Each page's scrollable area is a `flex-1 overflow-y-auto` div. This keeps the NavBar and any sticky headers fixed while the content list scrolls independently.

The doctor dashboard takes this a step further: the date/calendar/tabs section is `shrink-0` and the consult list section is `flex-1 overflow-y-auto`, so only the tiles scroll while the week strip and tabs stay pinned.

---

## Routing

```
/                     → redirect to /login
/login                → Login (no auth)
/onboarding           → Onboarding (no auth — JWT present but role not yet set)
/shared/:token        → SharedRecord (no auth)

/doctor               → DoctorDashboard   ┐
/doctor/patients      → PatientList        │ RequireAuth role="doctor"
/doctor/patients/:id  → PatientRecord      │ inside DoctorLayout
/doctor/consult/new   → NewConsult         │
/doctor/consult/:id   → NewConsult         ┘

/patient              → PatientHome        ┐ RequireAuth role="patient"
/patient/shares       → PatientShares      ┘ inside PatientLayout
```
