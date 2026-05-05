import json
import os
from services.rxnorm import check_interactions
from core.llm import LLM

llm = LLM()

SOAP_SCHEMA = {
    "subjective": "string - patient complaints, symptoms, history as reported",
    "objective": "string - vitals, physical exam findings, test results",
    "assessment": "string - diagnosis or differential diagnoses",
    "plan": "string - treatment plan, medications, procedures ordered",
    "medications": ["list of medication names mentioned (generic names, lowercase)"],
    "missing_fields": ["list of important fields that are missing or unclear"],
    "followup_questions": ["list of questions doctor should ask patient on next visit"],
    "plain_language_summary": "string - 2-3 sentence summary a patient can understand"
}

with open(os.path.join(os.path.dirname(__file__), "../prompts/SOAP_PROMPT.txt"), "r") as f:
    _SYSTEM_PROMPT_TEMPLATE = f.read()


def structure_soap(transcript: list[dict]) -> dict:
    """
    transcript: [{"speaker": "DOCTOR", "text": "..."}, ...]
    Returns structured SOAP dict
    """
    # Format transcript
    formatted = "\n".join(
        f"{turn['speaker']}: {turn['text']}"
        for turn in transcript
    )

    # Inject schema into system prompt
    system_prompt = _SYSTEM_PROMPT_TEMPLATE.replace(
        "{{SOAP_SCHEMA}}", json.dumps(SOAP_SCHEMA, indent=2)
    )

    # Build user prompt
    user_prompt = f"Transcript:\n\n{formatted}"

    # Call Gemini via LLM class
    soap = llm.generate_json(prompt=user_prompt, system_prompt=system_prompt)

    # Stage 6.5 — drug interaction check
    medications = soap.get("medications", [])
    if len(medications) >= 2:
        interactions = check_interactions(medications)
        soap["drug_interactions"] = interactions
    else:
        soap["drug_interactions"] = []

    return soap


if __name__ == "__main__":
    test_transcript = [
        {"speaker": "DOCTOR", "text": "What brings you in today?"},
        {"speaker": "PATIENT", "text": "I've had chest pain for 3 days, worse when I breathe deeply."},
        {"speaker": "DOCTOR", "text": "Any fever or cough?"},
        {"speaker": "PATIENT", "text": "Slight fever yesterday, no cough."},
        {"speaker": "DOCTOR", "text": "I'm prescribing atorvastatin and clarithromycin."},
    ]

    result = structure_soap(test_transcript)
    print(json.dumps(result, indent=2))