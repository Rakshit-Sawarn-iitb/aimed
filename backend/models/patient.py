from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

@dataclass
class Patient:
    id: UUID
    name: str
    age: int
    phone: str
    blood_group: str
    created_at: datetime