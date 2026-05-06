"""
api/patients.py
---------------
  GET /patients/               → list all patients the doctor has consulted
  GET /patients/by-phone/{phone}  → look up a patient by mobile number
"""

from fastapi import APIRouter, Depends, HTTPException
from core.auth import get_current_doctor_id
from db.session import get_supabase_admin

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("")
async def list_patients(doctor_id: str = Depends(get_current_doctor_id)):
    """
    Return all unique patients the doctor has ever consulted,
    with last-seen date and total consult count, sorted newest-first.
    """
    supabase = get_supabase_admin()

    consults_res = (
        supabase.table("consults")
        .select("patient_id, created_at")
        .eq("doctor_id", doctor_id)
        .order("created_at", desc=True)
        .execute()
    )
    rows = consults_res.data or []

    # Aggregate per patient (first occurrence = most recent due to desc order)
    patient_meta: dict[str, dict] = {}
    for row in rows:
        pid = row["patient_id"]
        if pid not in patient_meta:
            patient_meta[pid] = {"last_seen": row["created_at"], "consult_count": 0}
        patient_meta[pid]["consult_count"] += 1

    if not patient_meta:
        return []

    patient_ids = list(patient_meta.keys())
    pats_res = (
        supabase.table("patients")
        .select("id, name, phone")
        .in_("id", patient_ids)
        .execute()
    )

    result = []
    for p in (pats_res.data or []):
        meta = patient_meta.get(p["id"], {})
        result.append({
            "id": p["id"],
            "name": p.get("name") or "Unknown",
            "phone": p.get("phone"),
            "last_seen": meta.get("last_seen"),
            "consult_count": meta.get("consult_count", 0),
        })

    result.sort(key=lambda x: x["last_seen"] or "", reverse=True)
    return result


@router.get("/by-phone/{phone}")
async def get_patient_by_phone(
    phone: str,
    doctor_id: str = Depends(get_current_doctor_id),
):
    """
    Find a patient by their 10-digit mobile number.
    Tries exact match, then with the +91 country code prefix.
    Returns id, name, age, blood_group.
    """
    supabase = get_supabase_admin()

    def _query(p: str):
        return supabase.table("patients").select("id, name, age, blood_group, phone").eq("phone", p).execute()

    res = _query(phone)
    if not res.data:
        res = _query(f"+91{phone}")
    if not res.data:
        raise HTTPException(status_code=404, detail="No patient found with this number.")

    return res.data[0]
