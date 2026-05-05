from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

class JobStatus(Enum):
    PENDING = "pending"
    TRANSCRIBING = "transcribing"
    ANALYSING = "analysing"
    STRUCTURING = "structuring"
    COMPLETED = "completed"
    FAILED = "failed"

@dataclass
class ProcessingJob:
    job_id: str
    sarvam_job_id: str
    status: JobStatus
    doctor_id: str
    patient_id: str
    transcript: Optional[list] = field(default=None)
    soap_note: Optional[dict] = field(default=None)
    error: Optional[str] = field(default=None)