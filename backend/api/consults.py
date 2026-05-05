"""
api/consults.py
---------------
REST endpoints for the consult lifecycle:

  POST   /consults                  → create consult row, return signed upload URL
  POST   /consults/{id}/finalize    → trigger transcription pipeline (BackgroundTask)
  GET    /consults/{id}             → consult detail + utterances + report
  GET    /consults/{id}/status      → lightweight poll (status + error only)
  PATCH  /consults/{id}/speaker     → doctor manually corrects speaker labels
                                      (re-runs SOAP in background if already extracted)
  POST   /consults/{id}/approve     → doctor approves SOAP note, freezes record

All routes require a valid Supabase JWT (doctor role).
"""

import asyncio
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
    ConsultListItem,
    ConsultStatusResponse,
    SpeakerLabelOverride,
    UtteranceOut,
    SpeakerMapOut,
    ReportOut,
)
from services.soap import structure_soap
from workers.transcription_worker import run_transcription_pipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/consults", tags=["consults"])

RAW_AUDIO_BUCKET = "audio-raw"
UPLOAD_URL_TTL   = 1800
EXTRACTION_MODEL = "gemini-2.5-flash"


# ---------------------------------------------------------------------------
# GET /consults
# ---------------------------------------------------------------------------

@router.get("", response_model=list[ConsultListItem])
async def list_consults(doctor_id: str = Depends(get_current_doctor_id)):
    """Return all consults for the authenticated doctor, newest first."""
    supabase = get_supabase_admin()
    res = (
        supabase.table("consults")
        .select("id, patient_id, status, started_at, finalized_at, created_at, sarvam_error")
        .eq("doctor_id", doctor_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [ConsultListItem(**row) for row in (res.data or [])]


# ---------------------------------------------------------------------------
# POST /consults
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

    consult_id = str(uuid.uuid4())
    supabase.table("consults").insert({
        "id":         consult_id,
        "patient_id": str(body.patient_id),
        "doctor_id":  doctor_id,
        "status":     "recording",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }).execute()
    logger.info("Created consult %s (doctor=%s, patient=%s)", consult_id, doctor_id, body.patient_id)

    return ConsultCreateResponse(
        consult_id=consult_id,
        upload_url=_make_signed_upload_url(supabase, consult_id),
    )


def _make_signed_upload_url(supabase, consult_id: str) -> str:
    object_key = f"raw/{consult_id}"
    try:
        response = supabase.storage.from_(RAW_AUDIO_BUCKET).create_signed_upload_url(
            path=object_key,
        )
        url = (
            response.get("signedURL")
            or response.get("signed_url")
            or response.get("url", "")
        )
        if not url:
            url = f"{supabase.supabase_url}/storage/v1/object/{RAW_AUDIO_BUCKET}/{object_key}"
        return url
    except Exception as exc:
        logger.warning("Could not create signed upload URL: %s", exc)
        return f"supabase-storage://{RAW_AUDIO_BUCKET}/raw/{consult_id}"


# ---------------------------------------------------------------------------
# POST /consults/{id}/finalize
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

    Returns 202 Accepted immediately; the frontend should poll
    GET /consults/{id}/status until status becomes 'in_review' (or 'failed').
    """
    supabase = get_supabase_admin()

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

    supabase.table("consults").update({
        "status":           "uploaded",
        "audio_object_key": body.audio_object_key,
    }).eq("id", consult_id).execute()

    background_tasks.add_task(
        run_transcription_pipeline,
        consult_id=consult_id,
        audio_object_key=body.audio_object_key,
        supabase_admin=supabase,
        doctor_speaker_override=body.doctor_speaker_id,
    )

    logger.info("Transcription pipeline queued for consult %s", consult_id)
    return {
        "consult_id": consult_id,
        "status":     "uploaded",
        "message":    "Transcription pipeline started. Poll /consults/{id}/status for updates.",
    }


# ---------------------------------------------------------------------------
# GET /consults/{id}/status
# ---------------------------------------------------------------------------

@router.get("/{consult_id}/status", response_model=ConsultStatusResponse)
async def get_consult_status(
    consult_id: str,
    doctor_id: str = Depends(get_current_doctor_id),
):
    """Lightweight status-only endpoint for frontend polling."""
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

    utterance_count_res = (
        supabase.table("utterances")
        .select("id", count="exact")
        .eq("consult_id", consult_id)
        .execute()
    )
    return ConsultStatusResponse(
        consult_id=consult_id,
        status=result.data["status"],
        sarvam_error=result.data.get("sarvam_error"),
        utterance_count=utterance_count_res.count or 0,
    )


# ---------------------------------------------------------------------------
# GET /consults/{id}
# ---------------------------------------------------------------------------

@router.get("/{consult_id}", response_model=ConsultOut)
async def get_consult(
    consult_id: str,
    doctor_id: str = Depends(get_current_doctor_id),
):
    """Return full consult detail including diarized utterances and SOAP report."""
    supabase = get_supabase_admin()

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

    # Utterances
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

    # Speaker map from transcript_json
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

    # Report — available once pipeline reaches in_review
    report_out = None
    if consult["status"] in ("in_review", "finalized"):
        report_res = (
            supabase.table("reports")
            .select("*")
            .eq("consult_id", consult_id)
            .single()
            .execute()
        )
        if report_res.data:
            r = report_res.data
            report_out = ReportOut(
                id=r.get("id"),
                soap_subjective=r.get("soap_subjective") or "",
                soap_objective=r.get("soap_objective") or "",
                soap_assessment=r.get("soap_assessment") or "",
                soap_plan=r.get("soap_plan") or "",
                drug_interactions=r.get("drug_interactions") or [],
                missing_fields=r.get("missing_fields") or [],
                followup_questions=r.get("followup_questions") or [],
                plain_language_summary=r.get("plain_language_summary"),
                extraction_model=r.get("extraction_model"),
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
        report=report_out,
    )


# ---------------------------------------------------------------------------
# PATCH /consults/{id}/speaker
# ---------------------------------------------------------------------------

@router.patch("/{consult_id}/speaker", status_code=200)
async def update_speaker_labels(
    consult_id: str,
    body: SpeakerLabelOverride,
    background_tasks: BackgroundTasks,
    doctor_id: str = Depends(get_current_doctor_id),
):
    """
    Doctor corrects speaker labels from the review UI.
    Re-labels all utterances and queues a SOAP re-extraction in the background
    because the existing SOAP note was generated with wrong speaker roles.
    """
    from services.speaker_labeling import label_speakers, SpeakerMap
    from services.sarvam_client import UtteranceEntry

    supabase = get_supabase_admin()

    result = (
        supabase.table("consults")
        .select("id, doctor_id, patient_id, status, transcript_json")
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
            detail="Speaker labels can only be changed during review.",
        )

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

    speaker_map = label_speakers(entries, override_doctor_speaker_id=body.doctor_speaker_id)

    # Update utterance rows with corrected roles
    for entry in entries:
        supabase.table("utterances").update({
            "speaker_role": entry.speaker_role,
        }).eq("consult_id", consult_id).eq("idx", entry.idx).execute()

    # Update transcript_json speaker_map and entries
    transcript_json = result.data.get("transcript_json") or {}
    transcript_json["speaker_map"] = {
        "doctor_speaker_id": speaker_map.doctor_speaker_id,
        "patient_speaker_id": speaker_map.patient_speaker_id,
        "method": speaker_map.method,
        "confidence": speaker_map.confidence,
    }
    if "entries" in transcript_json:
        role_map = {e.idx: e.speaker_role for e in entries}
        for e in transcript_json["entries"]:
            e["speaker_role"] = role_map.get(e.get("idx", -1), "unknown")

    supabase.table("consults").update({
        "transcript_json": transcript_json,
    }).eq("id", consult_id).execute()

    # Re-run SOAP — old note used wrong speaker attribution
    background_tasks.add_task(
        _rerun_soap_extraction,
        consult_id=consult_id,
        patient_id=result.data["patient_id"],
        doctor_id=doctor_id,
        entries=entries,
        supabase=supabase,
    )

    return {
        "consult_id":         consult_id,
        "doctor_speaker_id":  speaker_map.doctor_speaker_id,
        "patient_speaker_id": speaker_map.patient_speaker_id,
        "updated_utterances": len(entries),
        "message":            "Speaker labels updated. SOAP note is being regenerated.",
    }


# ---------------------------------------------------------------------------
# POST /consults/{id}/approve
# ---------------------------------------------------------------------------

@router.post("/{consult_id}/approve", status_code=200)
async def approve_consult(
    consult_id: str,
    doctor_id: str = Depends(get_current_doctor_id),
):
    """
    Doctor reviews and approves the SOAP note.
    Transitions status from 'in_review' → 'finalized' and stamps finalized_at.
    A finalized consult is read-only — no further edits allowed.
    """
    supabase = get_supabase_admin()

    result = (
        supabase.table("consults")
        .select("id, doctor_id, status")
        .eq("id", consult_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Consult not found.")
    if result.data["doctor_id"] != doctor_id:
        raise HTTPException(status_code=403, detail="Not your consult.")
    if result.data["status"] != "in_review":
        raise HTTPException(
            status_code=409,
            detail=f"Only consults in 'in_review' can be approved. Current status: '{result.data['status']}'.",
        )

    # Block approval if any Tier-3 fact is still pending
    tier3_pending = (
        supabase.table("facts")
        .select("id", count="exact")
        .eq("consult_id", consult_id)
        .eq("risk_tier", 3)
        .eq("status", "pending")
        .execute()
    )
    if (tier3_pending.count or 0) > 0:
        raise HTTPException(
            status_code=409,
            detail=f"{tier3_pending.count} high-risk fact(s) still need review before approving.",
        )

    now = datetime.now(timezone.utc).isoformat()

    supabase.table("consults").update({
        "status":       "finalized",
        "finalized_at": now,
    }).eq("id", consult_id).execute()

    supabase.table("reports").update({
        "approved_at": now,
    }).eq("consult_id", consult_id).execute()

    logger.info("Consult %s approved and finalized by doctor %s", consult_id, doctor_id)
    return {
        "consult_id":   consult_id,
        "status":       "finalized",
        "finalized_at": now,
    }


# ---------------------------------------------------------------------------
# Background helper: re-run SOAP after speaker correction
# ---------------------------------------------------------------------------

async def _rerun_soap_extraction(
    consult_id: str,
    patient_id: str,
    doctor_id: str,
    entries: list,
    supabase,
) -> None:
    """Re-generate the SOAP note after the doctor corrects speaker labels."""
    try:
        supabase.table("consults").update({"status": "extracting"}).eq("id", consult_id).execute()
        logger.info("[%s] Re-running SOAP after speaker correction", consult_id)

        transcript = [
            {"speaker": e.speaker_role.upper(), "text": e.text}
            for e in entries
        ]

        loop = asyncio.get_event_loop()
        soap_result: dict = await loop.run_in_executor(None, structure_soap, transcript)

        supabase.table("reports").upsert({
            "consult_id":             consult_id,
            "patient_id":             patient_id,
            "doctor_id":              doctor_id,
            "soap_subjective":        soap_result.get("subjective", ""),
            "soap_objective":         soap_result.get("objective", ""),
            "soap_assessment":        soap_result.get("assessment", ""),
            "soap_plan":              soap_result.get("plan", ""),
            "drug_interactions":      soap_result.get("drug_interactions", []),
            "missing_fields":         soap_result.get("missing_fields", []),
            "followup_questions":     soap_result.get("followup_questions", []),
            "plain_language_summary": soap_result.get("plain_language_summary", ""),
            "extraction_model":       EXTRACTION_MODEL,
        }).execute()

        supabase.table("consults").update({
            "status":           "in_review",
            "extraction_model": EXTRACTION_MODEL,
        }).eq("id", consult_id).execute()

        logger.info("[%s] SOAP re-extraction complete ✓", consult_id)

    except Exception as exc:
        logger.exception("[%s] SOAP re-extraction failed after speaker fix", consult_id)
        supabase.table("consults").update({
            "status":       "failed",
            "sarvam_error": f"SOAP re-extraction failed: {exc}"[:2000],
        }).eq("id", consult_id).execute()
