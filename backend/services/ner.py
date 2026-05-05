import json
from core.llm import LLM
import os

llm = LLM()

with open(os.path.join(os.path.dirname(__file__), "../prompts/EXTRACTION_SYSTEM_PROMPT.txt"), "r") as f:
    EXTRACTION_SYSTEM_PROMPT = f.read()

def build_transcript_text(diarized_segments: list[dict]) -> str:
    """Convert diarized segments into a readable transcript string for the LLM."""
    lines = []
    for seg in diarized_segments:
        lines.append(f"{seg['speaker']}: {seg['text']}")
    return "\n".join(lines)


def extract_entities(diarized_segments: list[dict]) -> dict:
    """
    Takes diarized segments from Sarvam and returns extracted medical entities.
    """
    transcript_text = build_transcript_text(diarized_segments)
    
    prompt = f"""
Extract all medical entities from this doctor-patient consultation transcript:

{transcript_text}
"""
    
    entities = llm.generate_json(
        prompt=prompt,
        system_prompt=EXTRACTION_SYSTEM_PROMPT
    )
    
    return {
        "entities": entities,
        "all_drugs": entities.get("drugs", []),  # passed directly to RxNorm
        "transcript_text": transcript_text        # passed to SOAP structuring
    }

if __name__ == "__main__":
    segments = [
        {"speaker": "PATIENT", "text": "Mujhe 3 din se chest mein dard ho raha hai aur main atorvastatin le raha hoon."},
        {"speaker": "DOCTOR",  "text": "Koi aur medication? Clarithromycin already prescribed hai?"}
    ]

    result = extract_entities(segments)
    print(result["entities"])
    print("Drugs found:", result["all_drugs"])