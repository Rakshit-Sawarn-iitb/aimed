"""
api/facts.py
------------
  GET   /consults/{id}/facts          → all structured facts for a consult
  PATCH /facts/{fact_id}              → approve / reject / edit one fact
  GET   /consults/{id}/audio-url      → signed read URL for audio playback
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from core.auth import get_current_doctor_id
from db.session import get_supabase_admin
from models.consult import FactOut, FactReviewRequest

logger = logging.getLogger(__name__)

router = APIRouter(tags=["facts"])


# ---------------------------------------------------------------------------
# GET /consults/{id}/facts
# ---------------------------------------------------------------------------

@router.get("/consults/{consult_id}/facts", response_model=list[FactOut])
async def get_facts(
    consult_id: str,
    doctor_id: str = Depends(get_current_doctor_id),
):
    """
    Return all structured facts for a consult, ordered by risk_tier desc
    then category. Each fact includes audio seek timestamps derived from
    its source utterances.
    """
    supabase = get_supabase_admin()

    # Ownership check
    consult = (
        supabase.table("consults")
        .select("doctor_id, status")
        .eq("id", consult_id)
        .single()
        .execute()
        .data
    )
    if not consult:
        raise HTTPException(404, "Consult not found.")
    if consult["doctor_id"] != doctor_id:
        raise HTTPException(403, "Not your consult.")
    if consult["status"] not in ("in_review", "finalized", "extracting"):
        raise HTTPException(409, "Facts not available yet.")

    # Fetch facts
    facts_res = (
        supabase.table("facts")
        .select("*")
        .eq("consult_id", consult_id)
        .order("risk_tier", desc=True)
        .execute()
    )

    # Fetch utterances to resolve timestamps
    utt_res = (
        supabase.table("utterances")
        .select("idx, start_sec, end_sec")
        .eq("consult_id", consult_id)
        .execute()
    )
    idx_map = {
        u["idx"]: (float(u["start_sec"]), float(u["end_sec"]))
        for u in (utt_res.data or [])
    }

    out = []
    for f in (facts_res.data or []):
        idx_arr = f.get("source_utterance_idx_arr") or []
        times   = [idx_map[i] for i in idx_arr if i in idx_map]
        start   = min(t[0] for t in times) if times else None
        end     = max(t[1] for t in times) if times else None

        out.append(FactOut(
            id=f["id"],
            category=f["category"],
            text=f["text"],
            structured_payload=f.get("structured_payload") or {},
            evidence_quote=f.get("evidence_quote", ""),
            source_utterance_idx_arr=idx_arr,
            risk_tier=f["risk_tier"],
            risk_reason=f.get("risk_reason"),
            confidence=float(f["confidence"]),
            status=f["status"],
            individually_reviewed=f.get("individually_reviewed", False),
            audio_played=f.get("audio_played", False),
            reviewed_at=f.get("reviewed_at"),
            edit_history=f.get("edit_history") or [],
            start_sec=start,
            end_sec=end,
        ))

    return out


# ---------------------------------------------------------------------------
# PATCH /facts/{fact_id}
# ---------------------------------------------------------------------------

@router.patch("/facts/{fact_id}", status_code=200)
async def review_fact(
    fact_id: str,
    body: FactReviewRequest,
    doctor_id: str = Depends(get_current_doctor_id),
):
    """
    Approve, reject, or edit a single fact.
    Appends to edit_history and marks individually_reviewed.
    """
    supabase = get_supabase_admin()

    # Fetch fact + ownership via consult join
    fact_res = (
        supabase.table("facts")
        .select("*, consults(doctor_id, status)")
        .eq("id", fact_id)
        .single()
        .execute()
    )
    if not fact_res.data:
        raise HTTPException(404, "Fact not found.")

    fact    = fact_res.data
    consult = fact.get("consults", {})

    if consult.get("doctor_id") != doctor_id:
        raise HTTPException(403, "Not your consult.")
    if consult.get("status") not in ("in_review", "extracting"):
        raise HTTPException(409, "Consult is not in a reviewable state.")

    now          = datetime.now(timezone.utc).isoformat()
    edit_history = fact.get("edit_history") or []

    # Append audit entry
    edit_history.append({
        "action":       body.action,
        "edited_value": body.edited_value,
        "reviewed_by":  doctor_id,
        "reviewed_at":  now,
    })

    update: dict = {
        "status":              body.action,
        "individually_reviewed": True,
        "reviewed_by":         doctor_id,
        "reviewed_at":         now,
        "edit_history":        edit_history,
    }
    if body.audio_played is not None:
        update["audio_played"] = body.audio_played
    if body.action == "edited" and body.edited_value:
        update["structured_payload"] = body.edited_value

    supabase.table("facts").update(update).eq("id", fact_id).execute()

    logger.info("Fact %s → %s by doctor %s", fact_id, body.action, doctor_id)
    return {"fact_id": fact_id, "status": body.action}


# ---------------------------------------------------------------------------
# GET /consults/{id}/audio-url
# ---------------------------------------------------------------------------

@router.get("/consults/{consult_id}/audio-url")
async def get_audio_url(
    consult_id: str,
    doctor_id: str = Depends(get_current_doctor_id),
):
    """
    Returns a short-lived signed URL for the raw audio file.
    Frontend uses this with HTMLAudioElement and seeks to fact.start_sec.
    """
    supabase = get_supabase_admin()

    consult = (
        supabase.table("consults")
        .select("doctor_id, audio_object_key, audio_duration_sec")
        .eq("id", consult_id)
        .single()
        .execute()
        .data
    )
    if not consult:
        raise HTTPException(404, "Consult not found.")
    if consult["doctor_id"] != doctor_id:
        raise HTTPException(403, "Not your consult.")

    key = consult.get("audio_object_key")
    if not key:
        raise HTTPException(404, "No audio file associated with this consult.")

    try:
        res = supabase.storage.from_("audio-raw").create_signed_url(
            path=key,
            expires_in=3600,   # 1-hour URL
        )
        url = res.get("signedURL") or res.get("signed_url") or res.get("url", "")
    except Exception as exc:
        logger.warning("Failed to create signed audio URL: %s", exc)
        raise HTTPException(500, "Could not generate audio URL.")

    return {
        "url":               url,
        "audio_object_key":  key,
        "duration_sec":      consult.get("audio_duration_sec"),
        "expires_in":        3600,
    }
