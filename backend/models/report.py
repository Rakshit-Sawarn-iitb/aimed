from dataclasses import dataclass
from datetime import datetime
from uuid import UUID
from typing import Optional

@dataclass
class SOAPNote:
    subjective: str
    objective: str
    assessment: str
    plan: str

@dataclass
class Report:
    id: UUID
    patient_id: UUID
    doctor_id: UUID
    soap: SOAPNote
    drug_interactions: list
    missing_fields: list
    followup_questions: list
    plain_language_summary: str
    approved_at: Optional[datetime]
    created_at: datetime