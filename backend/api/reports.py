from fastapi import APIRouter, Depends, HTTPException
from core.auth import get_current_doctor_id
from db.session import get_supabase_admin
from models.consult import ReportOut, SOAPNoteOut

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/", response_model=list[ReportOut])
async def get_my_reports(doctor_id: str = Depends(get_current_doctor_id)):
    supabase = get_supabase_admin()
    res = supabase.table("reports").select("*").eq("doctor_id", doctor_id).execute()
    return [_to_report_out(r) for r in (res.data or [])]


@router.get("/{consult_id}", response_model=ReportOut)
async def get_report(
    consult_id: str,
    doctor_id: str = Depends(get_current_doctor_id),
):
    supabase = get_supabase_admin()
    res = (
        supabase.table("reports")
        .select("*")
        .eq("consult_id", consult_id)
        .eq("doctor_id", doctor_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Report not found.")
    return _to_report_out(res.data)


def _to_report_out(r: dict) -> ReportOut:
    soap_raw = r.get("soap_note") or {}
    return ReportOut(
        id=r.get("id"),
        soap_note=SOAPNoteOut(
            subjective=soap_raw.get("subjective", ""),
            objective=soap_raw.get("objective", ""),
            assessment=soap_raw.get("assessment", ""),
            plan=soap_raw.get("plan", ""),
        ),
        drug_interactions=r.get("drug_interactions") or [],
        missing_fields=r.get("missing_fields") or [],
        followup_questions=r.get("followup_questions") or [],
        plain_language_summary=r.get("plain_language_summary"),
        extraction_model=r.get("extraction_model"),
    )
