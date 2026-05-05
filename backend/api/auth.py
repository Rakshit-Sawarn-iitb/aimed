from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from db.session import get_supabase, get_supabase_admin

router = APIRouter(prefix="/auth", tags=["auth"])

# Schemas

class LoginRequest(BaseModel):
    email: str
    password: str

class DoctorSignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    clinic_name: str
    city: str
    phone: str

class PatientSignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    age: int
    phone: str
    blood_group: str

#  Doctor Auth 

@router.post("/doctor/signup")
async def doctor_signup(body: DoctorSignupRequest):
    supabase = get_supabase()
    admin = get_supabase_admin()

    res = supabase.auth.sign_up({"email": body.email, "password": body.password})
    if res.user is None:
        raise HTTPException(400, "Signup failed")

    user_id = res.user.id

    admin.table("doctors").insert({
        "id": user_id,
        "name": body.name,
        "clinic_name": body.clinic_name,
        "city": body.city,
        "phone": body.phone,
    }).execute()

    return {"message": "Doctor account created", "user_id": user_id}


@router.post("/doctor/login")
async def doctor_login(body: LoginRequest):
    supabase = get_supabase()
    admin = get_supabase_admin()

    res = supabase.auth.sign_in_with_password({"email": body.email, "password": body.password})
    if res.user is None:
        raise HTTPException(401, "Invalid credentials")

    result = admin.table("doctors").select("*").eq("id", res.user.id).execute()
    if not result.data:
        raise HTTPException(403, "Not a doctor account")

    doctor = result.data[0]
    return {
        "access_token": res.session.access_token,
        "refresh_token": res.session.refresh_token,
        "role": "doctor",
        "user": {
            "id": res.user.id,
            "email": res.user.email,
            "name": doctor["name"],
            "clinic_name": doctor["clinic_name"],
            "city": doctor["city"],
            "phone": doctor["phone"],
        }
    }

#  Patient Auth 

@router.post("/patient/signup")
async def patient_signup(body: PatientSignupRequest):
    supabase = get_supabase()
    admin = get_supabase_admin()

    res = supabase.auth.sign_up({"email": body.email, "password": body.password})
    if res.user is None:
        raise HTTPException(400, "Signup failed")

    user_id = res.user.id

    admin.table("patients").insert({
        "id": user_id,
        "name": body.name,
        "age": body.age,
        "phone": body.phone,
        "blood_group": body.blood_group,
    }).execute()

    return {"message": "Patient account created", "user_id": user_id}


@router.post("/patient/login")
async def patient_login(body: LoginRequest):
    supabase = get_supabase()
    admin = get_supabase_admin()

    res = supabase.auth.sign_in_with_password({"email": body.email, "password": body.password})
    if res.user is None:
        raise HTTPException(401, "Invalid credentials")

    result = admin.table("patients").select("*").eq("id", res.user.id).execute()
    if not result.data:
        raise HTTPException(403, "Not a patient account")

    patient = result.data[0]
    return {
        "access_token": res.session.access_token,
        "refresh_token": res.session.refresh_token,
        "role": "patient",
        "user": {
            "id": res.user.id,
            "email": res.user.email,
            "name": patient["name"],
            "age": patient["age"],
            "phone": patient["phone"],
            "blood_group": patient["blood_group"],
        }
    }

#  Shared 

@router.post("/logout")
async def logout():
    supabase = get_supabase()
    supabase.auth.sign_out()
    return {"message": "Logged out"}