"""
api/consults.py
---------------
REST endpoints for the consult lifecycle:

  POST   /consults                  → create consult row, return signed upload URL
  POST   /consults/{id}/finalize    → trigger transcription pipeline (BackgroundTask)
  GET    /consults/{id}             → consult detail + utterances
  GET    /consults/{id}/status      → lightweight poll (status + error only)
  PATCH  /consults/{id}/speaker     → doctor manually corrects speaker labels

All routes require a valid Supabase JWT (doctor role).
"""

import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from core.auth import get_current_doctor_id
from db.session import get_supabase_admin
from models.consult import (
    ConsultCreateRequest,
    ConsultCreateResponse,
    ConsultFinalizeRequest,
    ConsultOut,
    ConsultStatusResponse,
    SpeakerLabelOverride,
    UtteranceOut,
    SpeakerMapOut,
)
from workers.transcription_worker import run_transcription_pipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/consults", tags=["consults"])

# Supabase Storage bucket where the frontend uploads raw audio
RAW_AUDIO_BUCKET = "audio-raw"
# How long the signed upload URL is valid (seconds)
UPLOAD_URL_TTL = 1800  # 30 minutes


# ---------------------------------------------------------------------------
# POST /consults  — create a new consult
# ---------------------------------------------------------------------------

@router.post("", response_model=ConsultCreateResponse, status_code=201)
async def create_consult(
    body: ConsultCreateRequest,
    doctor_id: str = Depends(get_current_doctor_id),
):
    """
    Create a new consult row and return a signed URL so the frontend
    can upload raw audio directly to Supabase Storage.

    Idempotent: if idempotency_key matches an existing pending consult
    for this doctor+patient, returns the existing consult_id.
    """
    supabase = get_supabase_admin()

    # --- Idempotency check ---
    if body.idempotency_key:
        existing = (
            supabase.table("consults")
            .select("id, status")
            .eq("doctor_id", doctor_id)
            .eq("patient_id", str(body.patient_id))
            .eq("status", "recording")
            .limit(1)
            .execute()
        )
        if existing.data:
            consult_id = existing.data[0]["id"]
            logger.info("Idempotency hit — returning existing consult %s", consult_id)
            upload_url = _make_signed_upload_url(supabase, consult_id)
            return ConsultCreateResponse(
                consult_id=consult_id,
                upload_url=upload_url,
                message="Existing recording session resumed.",
            )

    # --- Create new consult row ---
    consult_id = str(uuid.uuid4())
    supabase.table("consults").insert({
        "id": consult_id,
        "patient_id": str(body.patient_id),
        "doctor_id": doctor_id,
        "status": "recording",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }).execute()
    logger.info("Created consult %s (doctor=%s, patient=%s)", consult_id, doctor_id, body.patient_id)

    upload_url = _make_signed_upload_url(supabase, consult_id)
    return ConsultCreateResponse(consult_id=consult_id, upload_url=upload_url)


def _make_signed_upload_url(supabase, consult_id: str) -> str:
    """Generate a signed upload URL for raw audio (30-min TTL)."""
    object_key = f"raw/{consult_id}"
    try:
        response = supabase.storage.from_(RAW_AUDIO_BUCKET).create_signed_upload_url(
            path=object_key,
        )
        # supabase-py returns a dict with 'signedURL' or 'signed_url'
        url = (
            response.get("signedURL")
            or response.get("signed_url")
            or response.get("url", "")
        )
        if not url:
            # Fallback: build a path URL (frontend uploads via service-role)
            url = f"{supabase.supabase_url}/storage/v1/object/{RAW_AUDIO_BUCKET}/{object_key}"
        return url
    except Exception as exc:
        logger.warning("Could not create signed upload URL: %s", exc)
        # Return a placeholder — frontend can use the Supabase JS SDK directly
        return f"supabase-storage://{RAW_AUDIO_BUCKET}/raw/{consult_id}"


# ---------------------------------------------------------------------------
# POST /consults/{id}/finalize  — trigger transcription pipeline
# ---------------------------------------------------------------------------

@router.post("/{consult_id}/finalize", status_code=202)
async def finalize_consult(
    consult_id: str,
    body: ConsultFinalizeRequest,
    background_tasks: BackgroundTasks,
    doctor_id: str = Depends(get_current_doctor_id),
):
    """
    Mark the audio upload as complete and kick off the transcription pipeline
    as a background task.

    Returns 202 Accepted immediately; the frontend should poll GET /consults/{id}/status
    until status becomes 'in_review' (or 'failed').
    """
    supabase = get_supabase_admin()

    # Verify this consult belongs to this doctor
    result = (
        supabase.table("consults")
        .select("id, status, doctor_id")
        .eq("id", consult_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Consult not found.")
    if result.data["doctor_id"] != doctor_id:
        raise HTTPException(status_code=403, detail="Not your consult.")
    if result.data["status"] not in ("recording", "uploaded", "failed"):
        raise HTTPException(
            status_code=409,
            detail=f"Consult is already in status '{result.data['status']}'. Cannot re-finalize.",
        )

    # Update status to 'uploaded'
    supabase.table("consults").update({
        "status": "uploaded",
        "audio_object_key": body.audio_object_key,
    }).eq("id", consult_id).execute()

    # Fire background pipeline
    background_tasks.add_task(
        run_transcription_pipeline,
        consult_id=consult_id,
        audio_object_key=body.audio_object_key,
        supabase_admin=supabase,
        doctor_speaker_override=body.doctor_speaker_id,
    )

    logger.info(
        "Transcription pipeline queued for consult %s (key=%s)",
        consult_id, body.audio_object_key,
    )
    return {
        "consult_id": consult_id,
        "status": "uploaded",
        "message": "Transcription pipeline started. Poll /consults/{id}/status for updates.",
    }


# ---------------------------------------------------------------------------
# GET /consults/{id}/status  — lightweight poll
# ---------------------------------------------------------------------------

@router.get("/{consult_id}/status", response_model=ConsultStatusResponse)
async def get_consult_status(
    consult_id: str,
    doctor_id: str = Depends(get_current_doctor_id),
):
    """
    Lightweight status-only endpoint for frontend polling.
    Returns status + sarvam_error + utterance count.
    """
    supabase = get_supabase_admin()

    result = (
        supabase.table("consults")
        .select("id, status, sarvam_error, doctor_id")
        .eq("id", consult_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Consult not found.")
    if result.data["doctor_id"] != doctor_id:
        raise HTTPException(status_code=403, detail="Not your consult.")

    # Count utterances
    utterance_count_res = (
        supabase.table("utterances")
        .select("id", count="exact")
        .eq("consult_id", consult_id)
        .execute()
    )
    utterance_count = utterance_count_res.count or 0
    print("hi this is sarvvam error",result.data.get("sarvam_error"))
    return ConsultStatusResponse(
        consult_id=consult_id,
        status=result.data["status"],
        sarvam_error=result.data.get("sarvam_error"),
        utterance_count=utterance_count,
    )


# ---------------------------------------------------------------------------
# GET /consults/{id}  — full consult detail with utterances
# ---------------------------------------------------------------------------

@router.get("/{consult_id}", response_model=ConsultOut)
async def get_consult(
    consult_id: str,
    doctor_id: str = Depends(get_current_doctor_id),
):
    """
    Return full consult detail including diarized utterances (once available).
    """
    supabase = get_supabase_admin()

    # Fetch consult
    result = (
        supabase.table("consults")
        .select("*")
        .eq("id", consult_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Consult not found.")
    consult = result.data
    if consult["doctor_id"] != doctor_id:
        raise HTTPException(status_code=403, detail="Not your consult.")

    # Fetch utterances
    utt_res = (
        supabase.table("utterances")
        .select("*")
        .eq("consult_id", consult_id)
        .order("idx")
        .execute()
    )
    utterances = [
        UtteranceOut(
            idx=u["idx"],
            speaker_id=u["speaker_id"],
            speaker_role=u.get("speaker_role", "unknown"),
            text=u["text"],
            start_sec=float(u["start_sec"]),
            end_sec=float(u["end_sec"]),
        )
        for u in (utt_res.data or [])
    ]

    # Extract speaker_map from transcript_json if available
    speaker_map_out = None
    if consult.get("transcript_json"):
        sm = consult["transcript_json"].get("speaker_map")
        if sm:
            speaker_map_out = SpeakerMapOut(
                doctor_speaker_id=sm.get("doctor_speaker_id", "0"),
                patient_speaker_id=sm.get("patient_speaker_id", "1"),
                method=sm.get("method", "unknown"),
                confidence=sm.get("confidence", 0.0),
            )

    return ConsultOut(
        id=consult["id"],
        patient_id=consult["patient_id"],
        doctor_id=consult["doctor_id"],
        status=consult["status"],
        audio_object_key=consult.get("audio_object_key"),
        sarvam_job_id=consult.get("sarvam_job_id"),
        sarvam_error=consult.get("sarvam_error"),
        transcript_hash=consult.get("transcript_hash"),
        extraction_model=consult.get("extraction_model"),
        started_at=consult.get("started_at"),
        finalized_at=consult.get("finalized_at"),
        created_at=consult.get("created_at"),
        utterances=utterances,
        speaker_map=speaker_map_out,
    )


# ---------------------------------------------------------------------------
# PATCH /consults/{id}/speaker  — doctor manually corrects speaker labels
# ---------------------------------------------------------------------------

@router.patch("/{consult_id}/speaker", status_code=200)
async def update_speaker_labels(
    consult_id: str,
    body: SpeakerLabelOverride,
    background_tasks: BackgroundTasks,
    doctor_id: str = Depends(get_current_doctor_id),
):
    """
    Doctor can flip the speaker mapping from the review UI toggle.
    Re-labels all utterances for this consult and updates transcript_json.
    """
    from services.speaker_labeling import label_speakers, SpeakerMap, _apply_roles
    from services.sarvam_client import UtteranceEntry

    supabase = get_supabase_admin()

    # Verify ownership
    result = (
        supabase.table("consults")
        .select("id, doctor_id, status, transcript_json")
        .eq("id", consult_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Consult not found.")
    if result.data["doctor_id"] != doctor_id:
        raise HTTPException(status_code=403, detail="Not your consult.")
    if result.data["status"] not in ("in_review", "extracting"):
        raise HTTPException(
            status_code=409,
            detail="Speaker labels can only be changed during review."
        )

    # Fetch current utterances
    utt_res = (
        supabase.table("utterances")
        .select("*")
        .eq("consult_id", consult_id)
        .order("idx")
        .execute()
    )
    entries = [
        UtteranceEntry(
            idx=u["idx"],
            speaker_id=u["speaker_id"],
            text=u["text"],
            start_sec=float(u["start_sec"]),
            end_sec=float(u["end_sec"]),
            speaker_role=u.get("speaker_role", "unknown"),
        )
        for u in (utt_res.data or [])
    ]

    # Re-label with override
    speaker_map = label_speakers(entries, override_doctor_speaker_id=body.doctor_speaker_id)

    # Update each utterance row
    for entry in entries:
        supabase.table("utterances").update({
            "speaker_role": entry.speaker_role,
        }).eq("consult_id", consult_id).eq("idx", entry.idx).execute()

    # Update transcript_json.speaker_map
    transcript_json = result.data.get("transcript_json") or {}
    transcript_json["speaker_map"] = {
        "doctor_speaker_id": speaker_map.doctor_speaker_id,
        "patient_speaker_id": speaker_map.patient_speaker_id,
        "method": speaker_map.method,
        "confidence": speaker_map.confidence,
    }
    # Also update the entries in transcript_json
    if "entries" in transcript_json:
        role_map = {e.idx: e.speaker_role for e in entries}
        for entry in transcript_json["entries"]:
            entry["speaker_role"] = role_map.get(entry.get("idx", -1), "unknown")

    supabase.table("consults").update({
        "transcript_json": transcript_json,
    }).eq("id", consult_id).execute()

    return {
        "consult_id": consult_id,
        "doctor_speaker_id": speaker_map.doctor_speaker_id,
        "patient_speaker_id": speaker_map.patient_speaker_id,
        "updated_utterances": len(entries),
    }
