"""
sarvam_client.py
----------------
Wraps the Sarvam Saaras v3 speech-to-text-job API.

Usage pattern (mirrors the reference Colab sarvam.ipynb):
    job = client.speech_to_text_job.create_job(
        model="saaras:v3",
        mode="codemix",
        with_diarization=True,
        num_speakers=2,
    )
    job.upload_files(file_paths=[wav_path])
    job.start()
    job.wait_until_complete()
    job.download_outputs(output_dir=output_dir)
    # parse  <output_dir>/<basename>.json  → data["diarized_transcript"]

The diarized_transcript structure:
    {
      "entries": [
        {
          "transcript": "Hi, I'm Suzanne.",
          "start_time_seconds": 0.01,
          "end_time_seconds": 2.19,
          "speaker_id": "0"
        },
        ...
      ]
    }
"""

import os
import json
import glob
import asyncio
import tempfile
import logging
from dataclasses import dataclass
from typing import Optional

from sarvamai import SarvamAI
from core.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data model for a single diarized utterance
# ---------------------------------------------------------------------------

@dataclass
class UtteranceEntry:
    """One speaker turn from the Sarvam diarized transcript."""
    idx: int           # 0-based position in the transcript
    speaker_id: str    # raw "0" or "1" from Sarvam
    text: str
    start_sec: float
    end_sec: float
    speaker_role: str = "unknown"  # filled in by speaker_labeling.py


# ---------------------------------------------------------------------------
# Sarvam client factory
# ---------------------------------------------------------------------------

def get_sarvam_client() -> SarvamAI:
    """Return a configured SarvamAI client."""
    api_key = settings.SARVAM_API_KEY
    if not api_key:
        raise RuntimeError(
            "SARVAM_API_KEY is not set. Add it to your .env file."
        )
    return SarvamAI(api_subscription_key=api_key)


# ---------------------------------------------------------------------------
# Job submission
# ---------------------------------------------------------------------------

def submit_transcription_job(wav_path: str) -> object:
    """
    Submit a Sarvam Saaras v3 transcription job for the given WAV file.

    Args:
        wav_path: Absolute path to a 16 kHz mono WAV file.

    Returns:
        The Sarvam job object (not yet started or completed).
    """
    client = get_sarvam_client()
    logger.info("Creating Sarvam job for: %s", wav_path)

    job = client.speech_to_text_job.create_job(
        model="saaras:v3",
        mode="codemix",           # best for Hindi-English code-mix
        with_diarization=True,
        num_speakers=2,           # doctor + patient
    )
    job.upload_files(file_paths=[wav_path])
    job.start()
    logger.info("Sarvam job started: %s", getattr(job, "id", "unknown"))
    return job


# ---------------------------------------------------------------------------
# Polling + output download
# ---------------------------------------------------------------------------

async def wait_for_job_and_download(
    job: object,
    timeout_seconds: int = 600,
) -> list[UtteranceEntry]:
    """
    Async-friendly wrapper: polls until the Sarvam job completes,
    downloads the JSON output, and parses it into UtteranceEntry objects.

    Sarvam's `job.wait_until_complete()` is a blocking call; we run it in
    a thread pool executor to avoid blocking the event loop.

    Args:
        job: The Sarvam job object returned by submit_transcription_job().
        timeout_seconds: Max wait time before raising TimeoutError.

    Returns:
        List of UtteranceEntry (unsorted by time, in transcript order).

    Raises:
        TimeoutError: if the job doesn't complete within timeout_seconds.
        RuntimeError: if the job fails on Sarvam's side.
    """
    output_dir = tempfile.mkdtemp(prefix="sarvam_out_")
    logger.info("Waiting for Sarvam job to complete (timeout=%ds)…", timeout_seconds)

    loop = asyncio.get_event_loop()

    try:
        await asyncio.wait_for(
            loop.run_in_executor(None, job.wait_until_complete),
            timeout=timeout_seconds,
        )
    except asyncio.TimeoutError:
        raise TimeoutError(
            f"Sarvam job did not complete within {timeout_seconds} seconds."
        )

    logger.info("Sarvam job completed. Downloading outputs to %s", output_dir)
    loop.run_in_executor(
        None,
        lambda: job.download_outputs(output_dir=output_dir),
    )
    # Give the executor a moment then parse synchronously
    await asyncio.sleep(1)
    job.download_outputs(output_dir=output_dir)

    return _parse_output_directory(output_dir)


def _parse_output_directory(output_dir: str) -> list[UtteranceEntry]:
    """
    Find the <filename>.wav.json output file and parse it.

    Sarvam writes: <output_dir>/<original_wav_basename>.json
    e.g.  output/aimed_<consult_id>.wav.json
    """
    json_files = glob.glob(os.path.join(output_dir, "*.json"))
    if not json_files:
        raise RuntimeError(
            f"No JSON output found in Sarvam output dir: {output_dir}"
        )

    json_path = json_files[0]
    logger.info("Parsing Sarvam output: %s", json_path)

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    return parse_diarized_transcript(data)


def parse_diarized_transcript(data: dict) -> list[UtteranceEntry]:
    """
    Convert the raw Sarvam JSON response into a list of UtteranceEntry objects.

    Expected structure:
        data["diarized_transcript"]["entries"] = [
            {
                "transcript": str,
                "start_time_seconds": float,
                "end_time_seconds": float,
                "speaker_id": "0" | "1",
            },
            ...
        ]

    Also handles the flat-list format (some Sarvam versions return entries
    directly at data["diarized_transcript"] without a nested "entries" key).
    """
    diarized = data.get("diarized_transcript", {})

    # Handle both {"entries": [...]} and direct list
    if isinstance(diarized, dict):
        entries_raw = diarized.get("entries", [])
    elif isinstance(diarized, list):
        entries_raw = diarized
    else:
        raise RuntimeError(
            f"Unexpected diarized_transcript format: {type(diarized)}"
        )

    entries: list[UtteranceEntry] = []
    for idx, entry in enumerate(entries_raw):
        entries.append(
            UtteranceEntry(
                idx=idx,
                speaker_id=str(entry.get("speaker_id", "0")),
                text=entry.get("transcript", ""),
                start_sec=float(entry.get("start_time_seconds", 0.0)),
                end_sec=float(entry.get("end_time_seconds", 0.0)),
            )
        )

    logger.info("Parsed %d utterances from Sarvam output.", len(entries))
    return entries


# ---------------------------------------------------------------------------
# High-level convenience: submit + wait (blocking, for use in workers)
# ---------------------------------------------------------------------------

def run_full_transcription_sync(wav_path: str, timeout_seconds: int = 600) -> list[UtteranceEntry]:
    """
    Synchronous version suitable for use inside a background thread.
    Submits the job, waits for completion, downloads output, and returns
    the parsed utterances.
    """
    job = submit_transcription_job(wav_path)
    output_dir = tempfile.mkdtemp(prefix="sarvam_out_")

    logger.info("Waiting for Sarvam job (blocking)…")
    job.wait_until_complete()
    job.download_outputs(output_dir=output_dir)

    return _parse_output_directory(output_dir)
