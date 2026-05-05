"""
transcription_worker.py
-----------------------
Background async worker that orchestrates the full audio → diarized transcript
pipeline for a single consult.

Pipeline steps:
  1. Download raw audio from Supabase Storage
  2. Transcode to 16 kHz mono WAV (ffmpeg)
  3. Submit to Sarvam Saaras v3 (codemix + diarization)
  4. Poll until complete, parse diarized JSON
  5. Label speakers (doctor vs patient)
  6. Persist utterances to Supabase DB
  7. Update consult status → 'extracting' (Claude call comes next)
  8. Clean up temp WAV file

The worker runs inside FastAPI's BackgroundTasks so it doesn't block
the HTTP response. For production, swap for Celery or ARQ.
"""

import os
import asyncio
import hashlib
import json
import logging
import tempfile
from datetime import datetime, timezone

from supabase import Client

from services.audio_pipeline import (
    download_raw_audio,
    transcode_to_wav,
    delete_wav_from_storage,
)
from services.sarvam_client import (
    submit_transcription_job,
    _parse_output_directory,
    run_full_transcription_sync,
    UtteranceEntry,
)
from services.speaker_labeling import label_speakers, SpeakerMap

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Status helpers
# ---------------------------------------------------------------------------

def _set_consult_status(supabase: Client, consult_id: str, status: str, **extra) -> None:
    """Update the consult row's status (and any extra fields) in Supabase."""
    payload = {"status": status, **extra}
    supabase.table("consults").update(payload).eq("id", consult_id).execute()
    logger.info("Consult %s → status=%s", consult_id, status)


def _set_consult_failed(supabase: Client, consult_id: str, error: str) -> None:
    supabase.table("consults").update({
        "status": "failed",
        "sarvam_error": error[:2000],  # cap length
    }).eq("id", consult_id).execute()
    logger.error("Consult %s failed: %s", consult_id, error)


# ---------------------------------------------------------------------------
# Utterance persistence
# ---------------------------------------------------------------------------

def _persist_utterances(
    supabase: Client,
    consult_id: str,
    entries: list[UtteranceEntry],
) -> None:
    """Insert utterance rows into Supabase (batch upsert)."""
    rows = [
        {
            "consult_id": consult_id,
            "idx": e.idx,
            "speaker_id": e.speaker_id,
            "speaker_role": e.speaker_role,
            "start_sec": e.start_sec,
            "end_sec": e.end_sec,
            "text": e.text,
        }
        for e in entries
    ]
    if rows:
        supabase.table("utterances").upsert(rows).execute()
    logger.info("Persisted %d utterances for consult %s", len(rows), consult_id)


# ---------------------------------------------------------------------------
# Main worker function
# ---------------------------------------------------------------------------

async def run_transcription_pipeline(
    consult_id: str,
    audio_object_key: str,        # Supabase Storage key for raw audio
    supabase_admin: Client,       # service-role client (bypasses RLS)
    doctor_speaker_override: str | None = None,  # "0" or "1" if known
) -> None:
    """
    Full pipeline: raw audio → diarized transcript → Supabase.

    This is fired as a BackgroundTask by POST /consults/{id}/finalize.
    All errors are caught and written to consult.sarvam_error so the
    doctor can see what went wrong and retry.
    """
    tmp_wav: str | None = None
    tmp_dir: str | None = None

    try:
        # ----------------------------------------------------------------
        # Step 1: Download raw audio
        # ----------------------------------------------------------------
        logger.info("[%s] Step 1: Downloading raw audio (%s)", consult_id, audio_object_key)
        tmp_dir = tempfile.mkdtemp(prefix=f"aimed_{consult_id[:8]}_")
        raw_ext = os.path.splitext(audio_object_key)[-1] or ".webm"
        raw_local = os.path.join(tmp_dir, f"raw{raw_ext}")

        await download_raw_audio(supabase_admin, audio_object_key, raw_local)

        # ----------------------------------------------------------------
        # Step 2: Transcode to 16 kHz mono WAV
        # ----------------------------------------------------------------
        logger.info("[%s] Step 2: Transcoding to WAV", consult_id)
        tmp_wav = os.path.join(tmp_dir, f"{consult_id}.wav")

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            transcode_to_wav,
            raw_local,
            tmp_wav,
        )

        # ----------------------------------------------------------------
        # Step 3: Submit to Sarvam + wait (blocking, in executor)
        # ----------------------------------------------------------------
        logger.info("[%s] Step 3: Submitting to Sarvam Saaras v3", consult_id)
        _set_consult_status(supabase_admin, consult_id, "transcribing")

        entries: list[UtteranceEntry] = await loop.run_in_executor(
            None,
            run_full_transcription_sync,
            tmp_wav,
            600,  # 10-minute timeout
        )

        # ----------------------------------------------------------------
        # Step 4: Speaker labeling
        # ----------------------------------------------------------------
        logger.info("[%s] Step 4: Speaker labeling", consult_id)
        # Use manual override if provided, else use LLM
        if doctor_speaker_override is not None:
            from services.speaker_labeling import label_speakers
            speaker_map: SpeakerMap = label_speakers(
                entries,
                override_doctor_speaker_id=doctor_speaker_override,
            )
        else:
            from services.speaker_labeling import label_speakers_with_llm
            speaker_map: SpeakerMap = label_speakers_with_llm(entries)

        # ----------------------------------------------------------------
        # Step 5: Build transcript_json and compute hash
        # ----------------------------------------------------------------
        transcript_json = {
            "entries": [
                {
                    "idx": e.idx,
                    "speaker_id": e.speaker_id,
                    "speaker_role": e.speaker_role,
                    "text": e.text,
                    "start_time_seconds": e.start_sec,
                    "end_time_seconds": e.end_sec,
                }
                for e in entries
            ],
            "speaker_map": {
                "doctor_speaker_id": speaker_map.doctor_speaker_id,
                "patient_speaker_id": speaker_map.patient_speaker_id,
                "method": speaker_map.method,
                "confidence": speaker_map.confidence,
            },
        }
        canonical = json.dumps(transcript_json, sort_keys=True, ensure_ascii=False)
        transcript_hash = hashlib.sha256(canonical.encode()).hexdigest()

        # ----------------------------------------------------------------
        # Step 6: Persist utterances
        # ----------------------------------------------------------------
        logger.info("[%s] Step 6: Persisting %d utterances", consult_id, len(entries))
        _persist_utterances(supabase_admin, consult_id, entries)

        # ----------------------------------------------------------------
        # Step 7: Update consult row
        # ----------------------------------------------------------------
        _set_consult_status(
            supabase_admin,
            consult_id,
            "extracting",           # next step: Claude extraction
            transcript_json=transcript_json,
            transcript_hash=transcript_hash,
        )
        logger.info("[%s] Transcription pipeline complete ✓", consult_id)

    except TimeoutError as exc:
        _set_consult_failed(supabase_admin, consult_id, f"Sarvam timeout: {exc}")

    except RuntimeError as exc:
        _set_consult_failed(supabase_admin, consult_id, str(exc))

    except Exception as exc:
        logger.exception("[%s] Unexpected error in transcription pipeline", consult_id)
        _set_consult_failed(supabase_admin, consult_id, f"Unexpected error: {exc}")

    finally:
        # Clean up temp files
        if tmp_dir and os.path.isdir(tmp_dir):
            import shutil
            shutil.rmtree(tmp_dir, ignore_errors=True)
            logger.debug("[%s] Cleaned up tmp dir: %s", consult_id, tmp_dir)
