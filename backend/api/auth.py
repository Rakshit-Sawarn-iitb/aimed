from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Literal
from gotrue.errors import AuthApiError
from postgrest.exceptions import APIError

from db.session import get_supabase, get_supabase_admin
from core.auth import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


# Schemas

class OtpStartRequest(BaseModel):
    phone: str = Field(..., description="E.164 phone number, e.g. +919876543210")


class OtpVerifyRequest(BaseModel):
    phone: str
    token: str = Field(..., min_length=4, max_length=10)


class DoctorProfileRequest(BaseModel):
    name: str
    clinic_name: str
    city: str


class PatientProfileRequest(BaseModel):
    name: str
    age: int = Field(..., ge=0, le=150)
    blood_group: str


# Helpers

def _normalize_phone(phone: str) -> str:
    # Strip whitespace; Supabase wants strict E.164
    return "".join(phone.split())


def _lookup_role(admin, user_id: str) -> tuple[Optional[Literal["doctor", "patient"]], Optional[dict]]:
    doc = admin.table("doctors").select("*").eq("id", user_id).execute()
    if doc.data:
        return "doctor", doc.data[0]
    pat = admin.table("patients").select("*").eq("id", user_id).execute()
    if pat.data:
        return "patient", pat.data[0]
    return None, None


# OTP

@router.post("/otp/start")
async def otp_start(body: OtpStartRequest):
    """Trigger an SMS OTP to the given phone. Creates the auth user on first use."""
    supabase = get_supabase()
    phone = _normalize_phone(body.phone)
    try:
        supabase.auth.sign_in_with_otp({
            "phone": phone,
            "options": {"should_create_user": True},
        })
        return {"message": "OTP sent"}
    except AuthApiError as e:
        raise HTTPException(status_code=400, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/otp/verify")
async def otp_verify(body: OtpVerifyRequest):
    """Verify an OTP. Returns session tokens plus role/profile if the user has completed onboarding."""
    supabase = get_supabase()
    admin = get_supabase_admin()
    phone = _normalize_phone(body.phone)

    try:
        res = supabase.auth.verify_otp({
            "phone": phone,
            "token": body.token,
            "type": "sms",
        })
    except AuthApiError as e:
        raise HTTPException(status_code=401, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not res.user or not res.session:
        raise HTTPException(401, "Invalid OTP")

    role, profile = _lookup_role(admin, res.user.id)

    return {
        "access_token": res.session.access_token,
        "refresh_token": res.session.refresh_token,
        "is_new": role is None,
        "role": role,
        "user": {
            "id": res.user.id,
            "phone": res.user.phone,
            **(profile or {}),
        },
    }


# Profile completion (post-OTP onboarding)

@router.post("/doctor/complete-profile")
async def doctor_complete_profile(
    body: DoctorProfileRequest,
    user: dict = Depends(get_current_user),
):
    """First-time doctor onboarding. Requires a valid Supabase JWT from /auth/otp/verify."""
    admin = get_supabase_admin()
    user_id = user["sub"]

    role, _ = _lookup_role(admin, user_id)
    if role is not None:
        raise HTTPException(409, f"Profile already exists as {role}")

    try:
        admin.table("doctors").insert({
            "id": user_id,
            "name": body.name,
            "clinic_name": body.clinic_name,
            "city": body.city,
            "phone": user.get("phone"),
        }).execute()
    except APIError as e:
        raise HTTPException(status_code=400, detail=e.message)

    return {
        "role": "doctor",
        "user": {
            "id": user_id,
            "phone": user.get("phone"),
            "name": body.name,
            "clinic_name": body.clinic_name,
            "city": body.city,
        },
    }


@router.post("/patient/complete-profile")
async def patient_complete_profile(
    body: PatientProfileRequest,
    user: dict = Depends(get_current_user),
):
    """First-time patient onboarding. Requires a valid Supabase JWT from /auth/otp/verify."""
    admin = get_supabase_admin()
    user_id = user["sub"]

    role, _ = _lookup_role(admin, user_id)
    if role is not None:
        raise HTTPException(409, f"Profile already exists as {role}")

    try:
        admin.table("patients").insert({
            "id": user_id,
            "name": body.name,
            "age": body.age,
            "phone": user.get("phone"),
            "blood_group": body.blood_group,
        }).execute()
    except APIError as e:
        raise HTTPException(status_code=400, detail=e.message)

    return {
        "role": "patient",
        "user": {
            "id": user_id,
            "phone": user.get("phone"),
            "name": body.name,
            "age": body.age,
            "blood_group": body.blood_group,
        },
    }


# Session

@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    """Return the authenticated user's role and profile, if any."""
    admin = get_supabase_admin()
    role, profile = _lookup_role(admin, user["sub"])
    return {
        "id": user["sub"],
        "phone": user.get("phone"),
        "role": role,
        "is_new": role is None,
        "profile": profile,
    }


@router.post("/logout")
async def logout():
    supabase = get_supabase()
    supabase.auth.sign_out()
    return {"message": "Logged out"}
