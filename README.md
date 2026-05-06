# AIMED — Medical Record Platform

**🌐 Live Demo:** [https://aimed.mooo.com/](https://aimed.mooo.com/)

## 🚀 Overview
**The doctor writes nothing. The patient owns everything.**

AIMED is an audit-grade medical scribe built specifically for the Indian healthcare context. It records a doctor-patient consultation in Hindi-English code-mix, transcribes it with speaker diarization, and extracts a structured medical record — then forces the doctor to verify every high-risk fact, with the source audio just one tap away.

## 🛑 The Problem
Indian medicine has a memory problem, and AI scribes are making it worse:
1. **Records live nowhere:** Patients see multiple doctors over years for the same complaint, repeating history from memory. Treatment plans contradict, and details get lost in drawer-bound prescriptions.
2. **Doctors skip the notes:** Doctors see 50+ patients a day. SOAP notes eat 30% of consult time, so they are often skipped. History is reconstructed from memory, leading to errors.
3. **Existing scribes rubber-stamp:** Most AI scribes are built for English-speaking US contexts. Indian code-mix breaks them. When they do work, doctors bulk-approve outputs they never read, turning AI hallucinations into prescriptions.

## 💡 The Solution
AIMED extracts what was *said in the room*. It does not recommend, prescribe, or diagnose. 
- **Record:** In-browser, code-mix friendly. MediaRecorder captures the consult. Sarvam Saaras v3 transcribes with speaker diarization in seconds.
- **Extract:** Claude Sonnet 4.6 enforces a strict schema. Every fact carries a literal evidence quote and source utterance indices.
- **Verify:** The doctor cannot rubber-stamp. Tier-3 facts (medications, diagnoses) require a tap — and the audio anchor must be played. Server-side enforced, server-side audited.
- **Own:** The record belongs to the patient. Patients can generate time-limited, OTP-gated share links for their next doctor.

## ⚙️ How It Works (Architecture)
From spoken consult to structured, auditable record in under 90 seconds.

1. **Browser**: `MediaRecorder` API captures audio.
2. **FastAPI Backend**: Uses `ffmpeg` to transcode to 16 kHz mono.
3. **Sarvam AI**: `Saaras v3` provides high-accuracy, code-mixed transcription and diarization.
4. **Claude AI**: `Sonnet 4.6` with tool-use extracts structured SOAP notes.
5. **Supabase**: Handles auth, Row Level Security (RLS), and secure audio storage.

## 🛡️ The Verification Spine
Three tiers of extracted facts, with one unforgiving rule:
* **T1 (Informational):** Symptoms, history, lifestyle. Bulk-approve allowed.
* **T2 (Consequential):** Vitals, exam findings, follow-up. One-tap individual approval required.
* **T3 (High-risk):** Medications, allergies, diagnoses. Audio anchor *must* be played before the doctor can approve.

## ⚖️ Ethics
* **Patient owns the record:** No vendor lock-in. Patients generate share links and track who opens them.
* **Every claim is citable:** Each fact carries a literal evidence quote.
* **Patient can dispute:** Non-blocking flags ride along with the record for the next doctor to see.
* **Lazy review is visible:** The audit summary tells the patient exactly how many audio anchors the doctor actually played. Trust pressure flows back to the doctor.

---
Built with ❤️ for the healthcare hackathon. Opinionated, audit-grade, deliberately narrow.
