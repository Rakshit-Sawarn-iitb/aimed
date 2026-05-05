"""
speaker_labeling.py
-------------------
Determines which Sarvam speaker_id ("0" or "1") is the doctor
and which is the patient.

Primary heuristic (no extra API call needed):
    Whoever speaks first in the transcript is the doctor.
    Rationale: the doctor presses Record, so they typically introduce
    themselves or greet the patient first.

Returns a SpeakerMap with:
    doctor_speaker_id:  "0" | "1"
    patient_speaker_id: "0" | "1"
    method: "first_speaker" | "manual"
    confidence: 0.0–1.0
"""

import logging
from dataclasses import dataclass
from typing import Literal
import json

from core.llm import LLM
from services.sarvam_client import UtteranceEntry

logger = logging.getLogger(__name__)


@dataclass
class SpeakerMap:
    """Mapping from Sarvam speaker IDs to clinical roles."""
    doctor_speaker_id: str    # "0" or "1"
    patient_speaker_id: str   # "0" or "1"
    method: str               # how the mapping was determined
    confidence: float         # 0.0–1.0


def label_speakers(
    entries: list[UtteranceEntry],
    override_doctor_speaker_id: str | None = None,
) -> SpeakerMap:
    """
    Assign doctor/patient roles to Sarvam speaker IDs.

    Args:
        entries: List of UtteranceEntry objects from the Sarvam parser.
        override_doctor_speaker_id: If the doctor manually specified which
            speaker they are (from the review UI toggle), pass "0" or "1"
            here to bypass the heuristic.

    Returns:
        SpeakerMap with roles assigned. Also mutates each entry's
        `speaker_role` field in-place for convenience.
    """
    if not entries:
        logger.warning("label_speakers called with empty entries list.")
        return SpeakerMap(
            doctor_speaker_id="0",
            patient_speaker_id="1",
            method="default_empty",
            confidence=0.0,
        )

    # --- Manual override from the UI ---
    if override_doctor_speaker_id is not None:
        doctor_id = str(override_doctor_speaker_id)
        patient_id = "1" if doctor_id == "0" else "0"
        speaker_map = SpeakerMap(
            doctor_speaker_id=doctor_id,
            patient_speaker_id=patient_id,
            method="manual",
            confidence=1.0,
        )
        _apply_roles(entries, speaker_map)
        logger.info(
            "Speaker labeling: manual override — doctor=speaker_%s", doctor_id
        )
        return speaker_map

    # --- Primary heuristic: first speaker = doctor ---
    first_speaker_id = entries[0].speaker_id
    other_speaker_id = "1" if first_speaker_id == "0" else "0"

    speaker_map = SpeakerMap(
        doctor_speaker_id=first_speaker_id,
        patient_speaker_id=other_speaker_id,
        method="first_speaker",
        confidence=0.75,  # heuristic, not guaranteed
    )
    _apply_roles(entries, speaker_map)

    logger.info(
        "Speaker labeling: first_speaker heuristic — doctor=speaker_%s (confidence=0.75)",
        first_speaker_id,
    )
    return speaker_map

def label_speakers_with_llm(
    entries: list[UtteranceEntry]
) -> SpeakerMap:
    """
    Assign doctor/patient roles to Sarvam speaker IDs using an LLM.
    """
    if not entries:
        return SpeakerMap(
            doctor_speaker_id="0",
            patient_speaker_id="1",
            method="default_empty",
            confidence=0.0,
        )

    llm = LLM()
    
    # Create a truncated transcript to feed to the LLM (first 10 utterances)
    transcript_sample = ""
    for entry in entries[:10]:
        transcript_sample += f"Speaker {entry.speaker_id}: {entry.text}\n"

    system_prompt = "You are a medical assistant that determines which speaker in a transcript is the doctor and which is the patient based on their dialogue."
    prompt = f"""
Given the following transcript from a medical consultation, identify which speaker is the doctor and which is the patient. 

Transcript:
{transcript_sample}

Return the result as a JSON object with two keys: "doctor_speaker_id" and "patient_speaker_id". The values should be the speaker IDs ("0" or "1").
"""
    try:
        result = llm.generate_json(prompt, system_prompt=system_prompt)
        doctor_id = str(result.get("doctor_speaker_id"))
        patient_id = "1" if doctor_id == "0" else "0"

        speaker_map = SpeakerMap(
            doctor_speaker_id=doctor_id,
            patient_speaker_id=patient_id,
            method="llm",
            confidence=0.90,
        )
        _apply_roles(entries, speaker_map)
        logger.info("Speaker labeling: LLM method — doctor=speaker_%s", doctor_id)
        return speaker_map
    except Exception as e:
        logger.error("LLM speaker labeling failed: %s. Falling back to first_speaker heuristic.", e)
        return label_speakers(entries)


def _apply_roles(entries: list[UtteranceEntry], speaker_map: SpeakerMap) -> None:
    """Mutate each entry's speaker_role based on the speaker_map."""
    for entry in entries:
        if entry.speaker_id == speaker_map.doctor_speaker_id:
            entry.speaker_role = "doctor"
        elif entry.speaker_id == speaker_map.patient_speaker_id:
            entry.speaker_role = "patient"
        else:
            entry.speaker_role = "unknown"


def get_speaker_stats(entries: list[UtteranceEntry]) -> dict:
    """
    Return basic statistics about speaker distribution in the transcript.
    Useful for the Claude speaker-labeling reinforcement call.
    """
    stats: dict[str, dict] = {}
    for entry in entries:
        sid = entry.speaker_id
        if sid not in stats:
            stats[sid] = {"utterance_count": 0, "total_words": 0, "first_start_sec": entry.start_sec}
        stats[sid]["utterance_count"] += 1
        stats[sid]["total_words"] += len(entry.text.split())

    return stats
