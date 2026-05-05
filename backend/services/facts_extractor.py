"""
services/facts_extractor.py
----------------------------
Extracts structured clinical facts from a labeled consultation transcript,
then assigns risk tiers via rule-based logic.

Output per fact matches the `facts` table schema:
  category, text, structured_payload, evidence_quote,
  source_utterance_idx_arr, confidence, risk_tier, risk_reason
"""

import json
from core.llm import LLM
from services.rxnorm import get_drug_class

llm = LLM()

# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a clinical fact extractor for Indian doctor-patient consultations.
The transcript may be in Hindi, English, or Hinglish. Translate all medical terms to English.

Extract every distinct clinical fact and return a JSON array of fact objects.
Each fact must strictly follow this schema:

{
  "category": <one of the allowed categories>,
  "text": "concise English summary (1 sentence)",
  "structured_payload": { <category-specific fields> },
  "evidence_quote": "exact words from the transcript that support this fact",
  "source_utterance_idx_arr": [<list of idx integers this fact comes from>],
  "confidence": <0.0 to 1.0>
}

Allowed categories and their structured_payload schemas:
- chief_complaint  → { "complaint": "..." }
- hpi              → { "description": "..." }
- past_history     → { "condition": "..." }
- current_medication → { "drug": "...", "dose": "...", "frequency": "...", "route": "...", "duration": "..." }
- allergy          → { "allergen": "...", "reaction": "..." }
- vital            → { "parameter": "...", "value": "...", "unit": "..." }
- exam_finding     → { "finding": "..." }
- assessment_observation → { "diagnosis": "...", "certainty": "confirmed|probable|possible" }
- plan             → { "action": "...", "drug": "...", "dose": "...", "frequency": "...", "duration": "..." }
- follow_up        → { "instruction": "...", "timeframe": "..." }
- social_history   → { "factor": "..." }

Confidence guide:
  1.0 = explicitly stated by doctor or patient
  0.8 = clearly implied
  0.6 = inferred, some ambiguity
  0.4 = uncertain, speculative

Rules:
- evidence_quote must be exact words from the transcript (can be a short phrase)
- source_utterance_idx_arr must reference real idx values from the input
- One fact per card — do not merge unrelated facts
- Return ONLY a valid JSON array, no markdown, no explanation"""


# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------

def extract_facts(utterances: list[dict]) -> list[dict]:
    """
    utterances: [{"idx": 0, "speaker_role": "doctor", "text": "...",
                  "start_sec": 0.0, "end_sec": 2.0}, ...]

    Returns list of fact dicts ready for DB insertion (risk_tier added by
    assign_risk_tiers — call that next).
    """
    transcript = "\n".join(
        f"[idx={u['idx']}][{u['speaker_role'].upper()}] {u['text']}"
        for u in utterances
    )

    prompt = f"Extract all clinical facts from this consultation transcript:\n\n{transcript}"

    raw = llm.generate_json(prompt=prompt, system_prompt=SYSTEM_PROMPT)

    # LLM might wrap the array in a dict key
    if isinstance(raw, dict):
        facts_raw = raw.get("facts", raw.get("data", list(raw.values())[0] if raw else []))
    else:
        facts_raw = raw if isinstance(raw, list) else []

    # Build idx → timestamps lookup
    idx_map = {u["idx"]: (float(u["start_sec"]), float(u["end_sec"])) for u in utterances}

    result = []
    for f in facts_raw:
        idx_arr = [int(i) for i in f.get("source_utterance_idx_arr", [])]
        times   = [idx_map[i] for i in idx_arr if i in idx_map]

        result.append({
            "category":                 _safe_category(f.get("category", "hpi")),
            "text":                     f.get("text", ""),
            "structured_payload":       f.get("structured_payload", {}),
            "evidence_quote":           f.get("evidence_quote", ""),
            "source_utterance_idx_arr": idx_arr,
            "confidence":               max(0.0, min(1.0, float(f.get("confidence", 0.8)))),
            # Derived audio range — stored in structured_payload for API use
            "_start_sec": min(t[0] for t in times) if times else None,
            "_end_sec":   max(t[1] for t in times) if times else None,
        })

    return result


VALID_CATEGORIES = {
    "chief_complaint", "hpi", "past_history", "current_medication",
    "allergy", "vital", "exam_finding", "assessment_observation",
    "plan", "follow_up", "social_history",
}

def _safe_category(cat: str) -> str:
    return cat if cat in VALID_CATEGORIES else "hpi"


# ---------------------------------------------------------------------------
# Risk tier assignment (rule-based, no LLM)
# ---------------------------------------------------------------------------

def _check_vital(payload: dict) -> tuple[int, str]:
    param = payload.get("parameter", "").lower()
    try:
        val = float(str(payload.get("value", "")).split("/")[0].replace(",", "."))
    except ValueError:
        return 1, ""

    if "bp" in param or "blood pressure" in param or "systolic" in param:
        if val >= 180 or val < 80:
            return 3, f"Critical BP: {val}"
        if val >= 140 or val < 90:
            return 2, f"Abnormal BP: {val}"

    if "temp" in param or "temperature" in param:
        # Accept Celsius or Fahrenheit — if < 50 assume Celsius
        if val < 50:
            val = val * 9 / 5 + 32  # convert to F
        if val >= 104:
            return 3, f"Critical temperature: {val:.1f}°F"
        if val >= 100.4:
            return 2, f"Fever: {val:.1f}°F"

    if "spo2" in param or "oxygen" in param or "saturation" in param:
        if val < 92:
            return 3, f"Critical SpO2: {val}%"
        if val < 95:
            return 2, f"Low SpO2: {val}%"

    if "hr" in param or "heart rate" in param or "pulse" in param:
        if val > 150 or val < 40:
            return 3, f"Critical HR: {val}"
        if val > 100 or val < 50:
            return 2, f"Abnormal HR: {val}"

    return 1, ""


def assign_risk_tiers(facts: list[dict]) -> list[dict]:
    """
    Mutates each fact dict in-place, adding 'risk_tier' and 'risk_reason'.
    Drug class resolution uses RxNorm RxClass API via get_drug_class().
    Fails open on API errors (no class → no flag, avoids false positives).
    Must be called after extract_facts().
    """
    # Resolve allergy classes for all allergy facts up front (batched lookups)
    allergy_classes: set[str] = set()
    for f in facts:
        if f["category"] == "allergy":
            allergen = f["structured_payload"].get("allergen", "")
            cls = get_drug_class(allergen)
            if cls:
                allergy_classes.add(cls)

    for f in facts:
        tier, reason = 1, ""
        cat        = f["category"]
        payload    = f.get("structured_payload", {})
        confidence = f.get("confidence", 1.0)

        # Drug-allergy conflict check
        if cat in ("current_medication", "plan"):
            drug     = payload.get("drug", "")
            drug_cls = get_drug_class(drug)
            if drug_cls and drug_cls in allergy_classes:
                tier   = 3
                reason = (
                    f"Allergy conflict: {drug} ({drug_cls} class) — "
                    f"patient has {drug_cls} allergy"
                )

        # Vital sign rules
        elif cat == "vital" and tier < 3:
            tier, reason = _check_vital(payload)

        # Low confidence on critical categories
        if tier < 3 and confidence < 0.6 and cat in (
            "current_medication", "allergy", "plan", "assessment_observation"
        ):
            tier   = max(tier, 2)
            reason = reason or f"Low confidence ({confidence:.0%})"
        elif tier < 2 and confidence < 0.75:
            tier   = 2
            reason = f"Low confidence ({confidence:.0%})"

        if tier == 1:
            reason = "No flags"

        f["risk_tier"]   = tier
        f["risk_reason"] = reason

    return facts
