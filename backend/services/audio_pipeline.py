"""
audio_pipeline.py
-----------------
Handles audio transcoding (ffmpeg) and Supabase Storage operations.

Flow:
  raw upload (webm/mp4/mp3) → transcode_to_wav() → 16kHz mono WAV
                             → upload_wav_to_storage() → Storage key
                             (after Sarvam finishes) → delete_wav_from_storage()
"""

import os
import asyncio
import subprocess
import tempfile
import logging
from pathlib import Path

import aiofiles
from supabase import Client

logger = logging.getLogger(__name__)

# Supabase Storage bucket for processed WAV files (short-lived)
WAV_BUCKET = "audio-wav"
# Supabase Storage bucket for original uploaded audio (kept 30 days)
RAW_BUCKET = "audio-raw"


# ---------------------------------------------------------------------------
# Transcoding
# ---------------------------------------------------------------------------

def transcode_to_wav(input_path: str, output_path: str) -> None:
    """
    Transcode any audio file to mono 16 kHz WAV using ffmpeg.
    Matches the Colab notebook: ffmpeg -i <input> -ac 1 -ar 16000 <output>

    Raises:
        RuntimeError: if ffmpeg exits with a non-zero code.
    """
    cmd = [
        "ffmpeg",
        "-i", input_path,
        "-ac", "1",          # mono
        "-ar", "16000",      # 16 kHz — required by Sarvam
        "-y",                # overwrite output without asking
        output_path,
    ]
    logger.info("Transcoding audio: %s → %s", input_path, output_path)
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        logger.error("ffmpeg stderr: %s", result.stderr)
        raise RuntimeError(
            f"ffmpeg transcoding failed (exit {result.returncode}): {result.stderr[-500:]}"
        )
    logger.info("Transcoding complete: %s", output_path)


# ---------------------------------------------------------------------------
# Supabase Storage helpers
# ---------------------------------------------------------------------------

async def download_raw_audio(supabase: Client, object_key: str, dest_path: str) -> None:
    """
    Download the raw audio file from Supabase Storage to a local path.
    Uses the service-role client so RLS is bypassed.
    """
    logger.info("Downloading raw audio: bucket=%s key=%s", RAW_BUCKET, object_key)
    # supabase-py storage download is synchronous; run in executor
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: supabase.storage.from_(RAW_BUCKET).download(object_key),
    )
    async with aiofiles.open(dest_path, "wb") as f:
        await f.write(response)
    logger.info("Downloaded raw audio to %s (%d bytes)", dest_path, len(response))


async def upload_wav_to_storage(supabase: Client, wav_path: str, consult_id: str) -> str:
    """
    Upload the transcoded WAV to Supabase Storage.
    Returns the storage object key, e.g. 'wav/<consult_id>.wav'.
    """
    object_key = f"wav/{consult_id}.wav"
    logger.info("Uploading WAV to storage: %s", object_key)

    async with aiofiles.open(wav_path, "rb") as f:
        data = await f.read()

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None,
        lambda: supabase.storage.from_(WAV_BUCKET).upload(
            path=object_key,
            file=data,
            file_options={"content-type": "audio/wav", "upsert": "true"},
        ),
    )
    logger.info("WAV uploaded: %s (%d bytes)", object_key, len(data))
    return object_key


async def delete_wav_from_storage(supabase: Client, object_key: str) -> None:
    """
    Delete the temporary WAV from Supabase Storage after Sarvam finishes.
    Non-fatal — logs a warning on failure.
    """
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: supabase.storage.from_(WAV_BUCKET).remove([object_key]),
        )
        logger.info("Deleted temp WAV from storage: %s", object_key)
    except Exception as exc:
        logger.warning("Failed to delete temp WAV %s: %s", object_key, exc)


# ---------------------------------------------------------------------------
# Convenience: full transcode pipeline with temp files
# ---------------------------------------------------------------------------

async def transcode_audio_from_storage(
    supabase: Client,
    raw_object_key: str,
    consult_id: str,
) -> str:
    """
    End-to-end helper:
      1. Download raw audio from Storage to a temp file.
      2. Transcode to 16 kHz mono WAV.
      3. Return the local WAV path (caller is responsible for cleanup).

    The returned path lives inside a system temp dir; caller should delete it
    after the Sarvam job is submitted.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        # Derive a safe filename from the key
        raw_filename = Path(raw_object_key).name
        raw_local = os.path.join(tmpdir, raw_filename)
        wav_local = os.path.join(tmpdir, f"{consult_id}.wav")

        await download_raw_audio(supabase, raw_object_key, raw_local)
        transcode_to_wav(raw_local, wav_local)

        # Move WAV out of tmpdir so it survives the context manager
        import shutil
        final_wav = os.path.join(tempfile.gettempdir(), f"aimed_{consult_id}.wav")
        shutil.copy2(wav_local, final_wav)

    return final_wav
