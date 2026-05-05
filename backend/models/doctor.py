from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

@dataclass
class Doctor:
    id: UUID
    name: str
    clinic_name: str
    city: str
    phone: str
    created_at: datetime