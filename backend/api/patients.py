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


@router.get("/{patient_id}")
async def get_patient(
    patient_id: str,
    doctor_id: str = Depends(get_current_doctor_id),
):
    """
    Return the patient's profile plus their full consult history with this doctor.
    For finalized consults, includes the SOAP report summary.
    """
    supabase = get_supabase_admin()

    pat_res = (
        supabase.table("patients")
        .select("id, name, phone, age, blood_group")
        .eq("id", patient_id)
        .single()
        .execute()
    )
    if not pat_res.data:
        raise HTTPException(status_code=404, detail="Patient not found.")

    consults_res = (
        supabase.table("consults")
        .select("id, status, created_at, finalized_at")
        .eq("patient_id", patient_id)
        .eq("doctor_id", doctor_id)
        .order("created_at", desc=True)
        .execute()
    )
    consults = consults_res.data or []

    # Batch-fetch SOAP reports for all finalized consults in one query
    finalized_ids = [c["id"] for c in consults if c["status"] == "finalized"]
    reports_map: dict[str, dict] = {}
    if finalized_ids:
        reports_res = (
            supabase.table("reports")
            .select(
                "consult_id, soap_subjective, soap_objective, "
                "soap_assessment, soap_plan, plain_language_summary, "
                "followup_questions, drug_interactions"
            )
            .in_("consult_id", finalized_ids)
            .execute()
        )
        for r in (reports_res.data or []):
            reports_map[r["consult_id"]] = r

    consult_list = []
    for c in consults:
        entry: dict = {
            "id":           c["id"],
            "status":       c["status"],
            "created_at":   c["created_at"],
            "finalized_at": c.get("finalized_at"),
        }
        if c["id"] in reports_map:
            r = reports_map[c["id"]]
            entry["report"] = {
                "soap_subjective":        r.get("soap_subjective") or "",
                "soap_objective":         r.get("soap_objective") or "",
                "soap_assessment":        r.get("soap_assessment") or "",
                "soap_plan":              r.get("soap_plan") or "",
                "plain_language_summary": r.get("plain_language_summary"),
                "followup_questions":     r.get("followup_questions") or [],
                "drug_interactions":      r.get("drug_interactions") or [],
            }
        consult_list.append(entry)

    return {"patient": pat_res.data, "consults": consult_list}


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
