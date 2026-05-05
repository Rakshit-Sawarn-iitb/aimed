from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from core.auth import get_current_doctor_id
from db.session import get_supabase_admin
from models.consult import ReportOut, ReportEditRequest

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


@router.patch("/{consult_id}", response_model=ReportOut)
async def edit_report(
    consult_id: str,
    body: ReportEditRequest,
    doctor_id: str = Depends(get_current_doctor_id),
):
    """
    Doctor edits free-text SOAP fields directly.
    Only allowed while consult is in_review.
    """
    supabase = get_supabase_admin()

    # Ownership + status check via consult
    consult = (
        supabase.table("consults")
        .select("doctor_id, status")
        .eq("id", consult_id)
        .single()
        .execute()
        .data
    )
    if not consult:
        raise HTTPException(404, "Consult not found.")
    if consult["doctor_id"] != doctor_id:
        raise HTTPException(403, "Not your consult.")
    if consult["status"] != "in_review":
        raise HTTPException(409, "Report can only be edited while in review.")

    # Only update fields the doctor actually sent
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(400, "No fields to update.")

    res = (
        supabase.table("reports")
        .update(update)
        .eq("consult_id", consult_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Report not found.")
    return _to_report_out(res.data[0])


def _to_report_out(r: dict) -> ReportOut:
    return ReportOut(
        id=r.get("id"),
        soap_subjective=r.get("soap_subjective") or "",
        soap_objective=r.get("soap_objective") or "",
        soap_assessment=r.get("soap_assessment") or "",
        soap_plan=r.get("soap_plan") or "",
        drug_interactions=r.get("drug_interactions") or [],
        missing_fields=r.get("missing_fields") or [],
        followup_questions=r.get("followup_questions") or [],
        plain_language_summary=r.get("plain_language_summary"),
        extraction_model=r.get("extraction_model"),
    )
