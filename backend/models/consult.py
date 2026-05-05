"""
models/consult.py
-----------------
Pydantic schemas for the /consults API endpoints.
These are request/response models — not SQLAlchemy ORM models.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional, Literal
from uuid import UUID

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums as literals (avoids importing DB enums)
# ---------------------------------------------------------------------------

ConsultStatusLiteral = Literal[
    "recording", "uploaded", "transcribing",
    "extracting", "in_review", "finalized", "failed"
]

SpeakerRoleLiteral = Literal["doctor", "patient", "unknown"]


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class ConsultCreateRequest(BaseModel):
    """Body for POST /consults — create a new consult session."""
    patient_id: UUID = Field(..., description="UUID of the patient (from patients table)")
    idempotency_key: Optional[UUID] = Field(
        None,
        description="Client-generated UUID to prevent duplicate consult rows on retry"
    )


class ConsultFinalizeRequest(BaseModel):
    """Body for POST /consults/{id}/finalize — trigger the transcription pipeline."""
    audio_object_key: str = Field(
        ...,
        description="Supabase Storage key of the uploaded raw audio file"
    )
    doctor_speaker_id: Optional[Literal["0", "1"]] = Field(
        None,
        description="If the doctor knows which Sarvam speaker they are, pass '0' or '1'"
    )


class SpeakerLabelOverride(BaseModel):
    """Body for PATCH /consults/{id}/speaker — manual speaker-role correction."""
    doctor_speaker_id: Literal["0", "1"]


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class UtteranceOut(BaseModel):
    """Single diarized utterance returned to the frontend."""
    idx: int
    speaker_id: str
    speaker_role: SpeakerRoleLiteral
    text: str
    start_sec: float
    end_sec: float

    model_config = {"from_attributes": True}


class SpeakerMapOut(BaseModel):
    """Speaker labeling result included in the consult detail response."""
    doctor_speaker_id: str
    patient_speaker_id: str
    method: str
    confidence: float


class ConsultOut(BaseModel):
    """Full consult detail response."""
    id: str
    patient_id: str
    doctor_id: str
    status: ConsultStatusLiteral
    audio_object_key: Optional[str] = None
    sarvam_job_id: Optional[str] = None
    sarvam_error: Optional[str] = None
    transcript_hash: Optional[str] = None
    extraction_model: Optional[str] = None
    started_at: Optional[datetime] = None
    finalized_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    # Populated when status >= 'extracting'
    utterances: list[UtteranceOut] = []
    speaker_map: Optional[SpeakerMapOut] = None

    model_config = {"from_attributes": True}


class ConsultCreateResponse(BaseModel):
    """Response from POST /consults."""
    consult_id: str
    upload_url: str   # Signed Supabase Storage URL for the frontend to PUT audio
    message: str = "Consult created. Upload audio to upload_url, then call /finalize."


class ConsultStatusResponse(BaseModel):
    """Lightweight poll response — just status + error."""
    consult_id: str
    status: ConsultStatusLiteral
    sarvam_error: Optional[str] = None
    utterance_count: int = 0
