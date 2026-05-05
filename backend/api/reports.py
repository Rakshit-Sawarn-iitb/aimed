# api/reports.py  — example of a protected route
from db.session import get_supabase
from fastapi import APIRouter, Depends
from core.auth import get_current_doctor_id

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/")
async def get_my_reports(doctor_id: str = Depends(get_current_doctor_id)):
    # doctor_id is the verified UUID from the JWT
    supabase = get_supabase()
    res = supabase.table("reports").select("*").eq("doctor_id", doctor_id).execute()
    return res.data