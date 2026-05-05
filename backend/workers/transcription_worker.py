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
  6. Build transcript_json and compute hash
  7. Persist utterances to Supabase DB
  8. Update consult status → 'extracting'
  9. Run SOAP extraction (NER + Gemini + drug interactions)
 10. Persist report to reports table
 11. Update consult status → 'in_review'
 12. Clean up temp files
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
from services.soap import structure_soap
from services.facts_extractor import extract_facts, assign_risk_tiers

logger = logging.getLogger(__name__)

EXTRACTION_MODEL = "gemini-2.5-flash"


# ---------------------------------------------------------------------------
# Status helpers
# ---------------------------------------------------------------------------

def _set_consult_status(supabase: Client, consult_id: str, status: str, **extra) -> None:
    payload = {"status": status, **extra}
    supabase.table("consults").update(payload).eq("id", consult_id).execute()
    print(f"[PIPELINE] Consult {consult_id[:8]} → status={status}")
    logger.info("Consult %s → status=%s", consult_id, status)


def _set_consult_failed(supabase: Client, consult_id: str, error: str) -> None:
    supabase.table("consults").update({
        "status": "failed",
        "sarvam_error": error[:2000],
    }).eq("id", consult_id).execute()
    print(f"[PIPELINE] ❌ Consult {consult_id[:8]} FAILED: {error[:200]}")
    logger.error("Consult %s failed: %s", consult_id, error)


# ---------------------------------------------------------------------------
# Utterance persistence
# ---------------------------------------------------------------------------

def _persist_utterances(
    supabase: Client,
    consult_id: str,
    entries: list[UtteranceEntry],
) -> None:
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
        supabase.table("utterances").upsert(rows, on_conflict="consult_id,idx").execute()
    print(f"[PIPELINE] Persisted {len(rows)} utterances")
    logger.info("Persisted %d utterances for consult %s", len(rows), consult_id)


# ---------------------------------------------------------------------------
# Report persistence
# ---------------------------------------------------------------------------

def _persist_report(
    supabase: Client,
    consult_id: str,
    patient_id: str,
    doctor_id: str,
    soap_result: dict,
) -> None:
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
    print(f"[PIPELINE] Report persisted for consult {consult_id[:8]}")
    logger.info("Persisted report for consult %s", consult_id)


def _persist_facts(
    supabase: Client,
    consult_id: str,
    patient_id: str,
    facts: list[dict],
) -> None:
    rows = [
        {
            "consult_id":                f["consult_id"],
            "patient_id":                f["patient_id"],
            "category":                  f["category"],
            "text":                      f["text"],
            "structured_payload":        f["structured_payload"],
            "evidence_quote":            f["evidence_quote"] or "—",
            "source_utterance_idx_arr":  f["source_utterance_idx_arr"],
            "risk_tier":                 f["risk_tier"],
            "risk_reason":               f.get("risk_reason", ""),
            "confidence":                f["confidence"],
        }
        for f in facts
    ]
    if rows:
        supabase.table("facts").insert(rows).execute()
    print(f"[PIPELINE] Persisted {len(rows)} facts for consult {consult_id[:8]}")
    logger.info("Persisted %d facts for consult %s", len(rows), consult_id)


# ---------------------------------------------------------------------------
# Main worker function
# ---------------------------------------------------------------------------

async def run_transcription_pipeline(
    consult_id: str,
    audio_object_key: str,
    supabase_admin: Client,
    doctor_speaker_override: str | None = None,
) -> None:
    tmp_wav: str | None = None
    tmp_dir: str | None = None

    print(f"\n{'='*60}")
    print(f"[PIPELINE] Starting pipeline for consult {consult_id[:8]}")
    print(f"[PIPELINE] audio_object_key={audio_object_key}")
    print(f"[PIPELINE] doctor_speaker_override={doctor_speaker_override}")
    print(f"{'='*60}")

    try:
        # ----------------------------------------------------------------
        # Fetch consult metadata
        # ----------------------------------------------------------------
        consult_row = (
            supabase_admin.table("consults")
            .select("patient_id, doctor_id")
            .eq("id", consult_id)
            .single()
            .execute()
            .data
        )
        if not consult_row:
            raise RuntimeError(f"Consult {consult_id} not found")
        patient_id: str = consult_row["patient_id"]
        doctor_id:  str = consult_row["doctor_id"]
        print(f"[PIPELINE] Fetched consult metadata — patient={patient_id[:8]} doctor={doctor_id[:8]}")

        # ----------------------------------------------------------------
        # Step 1: Download raw audio
        # ----------------------------------------------------------------
        print(f"[PIPELINE] Step 1: Downloading raw audio from storage...")
        logger.info("[%s] Step 1: Downloading raw audio (%s)", consult_id, audio_object_key)
        tmp_dir = tempfile.mkdtemp(prefix=f"aimed_{consult_id[:8]}_")
        # No extension — ffmpeg detects format from file headers, not filename
        raw_local = os.path.join(tmp_dir, "raw_audio")

        await download_raw_audio(supabase_admin, audio_object_key, raw_local)
        file_size = os.path.getsize(raw_local)
        print(f"[PIPELINE] Step 1 ✓ — downloaded {file_size:,} bytes to {raw_local}")

        # ----------------------------------------------------------------
        # Step 2: Transcode to 16 kHz mono WAV
        # ----------------------------------------------------------------
        print(f"[PIPELINE] Step 2: Transcoding to 16kHz mono WAV...")
        logger.info("[%s] Step 2: Transcoding to WAV", consult_id)
        tmp_wav = os.path.join(tmp_dir, f"{consult_id}.wav")

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, transcode_to_wav, raw_local, tmp_wav)
        wav_size = os.path.getsize(tmp_wav)
        print(f"[PIPELINE] Step 2 ✓ — WAV ready ({wav_size:,} bytes)")

        # ----------------------------------------------------------------
        # Step 3: Submit to Sarvam + wait
        # ----------------------------------------------------------------
        print(f"[PIPELINE] Step 3: Submitting to Sarvam Saaras v3 (this may take a while)...")
        logger.info("[%s] Step 3: Submitting to Sarvam Saaras v3", consult_id)
        _set_consult_status(supabase_admin, consult_id, "transcribing")

        entries: list[UtteranceEntry] = await loop.run_in_executor(
            None,
            run_full_transcription_sync,
            tmp_wav,
            600,
        )
        print(f"[PIPELINE] Step 3 ✓ — Sarvam returned {len(entries)} utterances")

        # ----------------------------------------------------------------
        # Step 4: Speaker labeling
        # ----------------------------------------------------------------
        print(f"[PIPELINE] Step 4: Speaker labeling (override={doctor_speaker_override})...")
        logger.info("[%s] Step 4: Speaker labeling", consult_id)
        if doctor_speaker_override is not None:
            speaker_map: SpeakerMap = label_speakers(
                entries,
                override_doctor_speaker_id=doctor_speaker_override,
            )
        else:
            from services.speaker_labeling import label_speakers_with_llm
            speaker_map: SpeakerMap = label_speakers_with_llm(entries)
        print(f"[PIPELINE] Step 4 ✓ — doctor=speaker_{speaker_map.doctor_speaker_id}, method={speaker_map.method}")

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
        print(f"[PIPELINE] Step 5 ✓ — transcript hash={transcript_hash[:12]}...")

        # ----------------------------------------------------------------
        # Step 6: Persist utterances
        # ----------------------------------------------------------------
        print(f"[PIPELINE] Step 6: Persisting {len(entries)} utterances to DB...")
        logger.info("[%s] Step 6: Persisting %d utterances", consult_id, len(entries))
        _persist_utterances(supabase_admin, consult_id, entries)

        # Print first 3 utterances so we can sanity-check speaker roles
        print(f"[PIPELINE] Sample utterances:")
        for e in entries[:3]:
            print(f"  [{e.speaker_role.upper()}] {e.text[:80]}")

        # ----------------------------------------------------------------
        # Step 7: Mark as extracting
        # ----------------------------------------------------------------
        _set_consult_status(
            supabase_admin,
            consult_id,
            "extracting",
            transcript_json=transcript_json,
            transcript_hash=transcript_hash,
        )

        # ----------------------------------------------------------------
        # Step 8: Structured facts extraction + risk tier assignment
        # ----------------------------------------------------------------
        print(f"[PIPELINE] Step 8: Extracting structured facts...")
        logger.info("[%s] Step 8: Extracting structured facts", consult_id)

        utterances_for_extraction = [
            {
                "idx":         e.idx,
                "speaker_role": e.speaker_role,
                "text":        e.text,
                "start_sec":   e.start_sec,
                "end_sec":     e.end_sec,
            }
            for e in entries
        ]

        facts: list[dict] = await loop.run_in_executor(
            None, extract_facts, utterances_for_extraction
        )
        facts = await loop.run_in_executor(None, assign_risk_tiers, facts)

        # Attach consult + patient ids for DB insertion
        for f in facts:
            f["consult_id"] = consult_id
            f["patient_id"] = patient_id

        tier_counts = {1: 0, 2: 0, 3: 0}
        for f in facts:
            tier_counts[f["risk_tier"]] += 1
        print(f"[PIPELINE] Step 8 ✓ — {len(facts)} facts | "
              f"T1={tier_counts[1]} T2={tier_counts[2]} T3={tier_counts[3]}")

        # ----------------------------------------------------------------
        # Step 8b: Persist facts
        # ----------------------------------------------------------------
        print(f"[PIPELINE] Step 8b: Persisting facts to DB...")
        _persist_facts(supabase_admin, consult_id, patient_id, facts)

        # ----------------------------------------------------------------
        # Step 9: SOAP extraction
        # ----------------------------------------------------------------
        print(f"[PIPELINE] Step 9: Running SOAP extraction (NER + Gemini + drug check)...")
        logger.info("[%s] Step 9: Running SOAP extraction", consult_id)

        transcript_for_soap = [
            {"speaker": e.speaker_role.upper(), "text": e.text}
            for e in entries
        ]

        soap_result: dict = await loop.run_in_executor(
            None,
            structure_soap,
            transcript_for_soap,
        )
        print(f"[PIPELINE] Step 9 ✓ — SOAP keys: {list(soap_result.keys())}")
        print(f"[PIPELINE]   subjective: {str(soap_result.get('subjective', ''))[:80]}")
        print(f"[PIPELINE]   assessment: {str(soap_result.get('assessment', ''))[:80]}")
        print(f"[PIPELINE]   drug_interactions: {len(soap_result.get('drug_interactions', []))} found")

        # ----------------------------------------------------------------
        # Step 10: Persist report
        # ----------------------------------------------------------------
        print(f"[PIPELINE] Step 10: Persisting report to DB...")
        logger.info("[%s] Step 10: Persisting report", consult_id)
        _persist_report(supabase_admin, consult_id, patient_id, doctor_id, soap_result)

        # ----------------------------------------------------------------
        # Step 10: Mark as in_review
        # ----------------------------------------------------------------
        _set_consult_status(
            supabase_admin,
            consult_id,
            "in_review",
            extraction_model=EXTRACTION_MODEL,
        )
        print(f"[PIPELINE] ✅ Pipeline complete for consult {consult_id[:8]}")
        print(f"{'='*60}\n")
        logger.info("[%s] Full pipeline complete ✓", consult_id)

    except TimeoutError as exc:
        print(f"[PIPELINE] ❌ Sarvam timed out: {exc}")
        _set_consult_failed(supabase_admin, consult_id, f"Sarvam timeout: {exc}")

    except RuntimeError as exc:
        print(f"[PIPELINE] ❌ RuntimeError: {exc}")
        _set_consult_failed(supabase_admin, consult_id, str(exc))

    except Exception as exc:
        print(f"[PIPELINE] ❌ Unexpected error: {type(exc).__name__}: {exc}")
        logger.exception("[%s] Unexpected error in pipeline", consult_id)
        _set_consult_failed(supabase_admin, consult_id, f"Unexpected error: {exc}")

    finally:
        if tmp_dir and os.path.isdir(tmp_dir):
            import shutil
            shutil.rmtree(tmp_dir, ignore_errors=True)
            print(f"[PIPELINE] Cleaned up tmp dir")
            logger.debug("[%s] Cleaned up tmp dir: %s", consult_id, tmp_dir)
