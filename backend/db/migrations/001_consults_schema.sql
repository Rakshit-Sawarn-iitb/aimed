-- Migration 001: Create consults and utterances tables
-- Run this in your Supabase SQL editor or via psql

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
    CREATE TYPE consult_status AS ENUM (
        'recording', 'uploaded', 'transcribing', 'extracting',
        'in_review', 'finalized', 'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE fact_category AS ENUM (
        'chief_complaint','hpi','past_history','current_medication',
        'allergy','vital','exam_finding','assessment_observation',
        'plan','follow_up','social_history'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE fact_status AS ENUM ('pending','approved','rejected','edited');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE flag_type AS ENUM ('didnt_say','missing','wrong','unclear');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- CONSULTS
-- ============================================================

CREATE TABLE IF NOT EXISTS consults (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          UUID NOT NULL,   -- references patients.id (existing table)
    doctor_id           UUID NOT NULL,   -- references doctors.id (existing table)
    status              consult_status NOT NULL DEFAULT 'recording',
    audio_object_key    TEXT,            -- Supabase Storage key for raw audio
    audio_duration_sec  NUMERIC,
    sarvam_job_id       TEXT,
    sarvam_error        TEXT,
    transcript_json     JSONB,           -- full diarized response from Sarvam
    transcript_hash     TEXT,            -- sha256 of transcript_json
    extraction_model    TEXT,
    extraction_version  TEXT,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    finalized_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- UTTERANCES  (denormalized from transcript_json)
-- ============================================================

CREATE TABLE IF NOT EXISTS utterances (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consult_id      UUID NOT NULL REFERENCES consults(id) ON DELETE CASCADE,
    idx             INT  NOT NULL,               -- 0-based position in transcript
    speaker_id      TEXT NOT NULL,               -- raw '0' or '1' from Sarvam
    speaker_role    TEXT CHECK (speaker_role IN ('doctor','patient','unknown')),
    start_sec       NUMERIC NOT NULL,
    end_sec         NUMERIC NOT NULL,
    text            TEXT NOT NULL,
    UNIQUE (consult_id, idx)
);

-- ============================================================
-- FACTS  (extracted by Claude — scaffold for later)
-- ============================================================

CREATE TABLE IF NOT EXISTS facts (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consult_id               UUID NOT NULL REFERENCES consults(id) ON DELETE CASCADE,
    patient_id               UUID NOT NULL,
    category                 fact_category NOT NULL,
    text                     TEXT NOT NULL,
    structured_payload       JSONB,
    evidence_quote           TEXT NOT NULL,
    source_utterance_idx_arr INT[] NOT NULL,
    risk_tier                INT  NOT NULL CHECK (risk_tier IN (1,2,3)),
    confidence               NUMERIC NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    status                   fact_status NOT NULL DEFAULT 'pending',
    individually_reviewed    BOOLEAN NOT NULL DEFAULT FALSE,
    audio_played             BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by              UUID,
    reviewed_at              TIMESTAMPTZ,
    edit_history             JSONB DEFAULT '[]'::jsonb,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AUDIT LOG  (append-only)
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL PRIMARY KEY,
    actor_id    UUID,
    action      TEXT NOT NULL,
    target_kind TEXT NOT NULL,
    target_id   TEXT NOT NULL,
    payload     JSONB,
    ip_hash     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_consults_doctor_id   ON consults (doctor_id);
CREATE INDEX IF NOT EXISTS idx_consults_patient_id  ON consults (patient_id);
CREATE INDEX IF NOT EXISTS idx_utterances_consult   ON utterances (consult_id, idx);
CREATE INDEX IF NOT EXISTS idx_facts_consult        ON facts (consult_id);
CREATE INDEX IF NOT EXISTS idx_audit_target         ON audit_log (target_kind, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor          ON audit_log (actor_id, created_at DESC);
