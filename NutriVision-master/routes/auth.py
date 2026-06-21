from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Header, Request
from typing import Optional
import sqlite3
from database import get_db
from services.auth_service import hash_password, verify_password, create_access_token, decode_access_token, generate_reset_token
from services.health_calculator import calculate_bmr, calculate_tdee, calculate_targets
import crud
from schemas import RegisterRequest, LoginRequest, ForgotPasswordRequest, ResetPasswordRequest, AuthResponse
from logging_config import get_logger, authenticated_user_id
from metrics import auth_success_total, auth_failure_total

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = get_logger("nutrivision.auth")

from rate_limiter import rate_limit as _rate_limit


def get_current_user(authorization: Optional[str] = Header(None), db: sqlite3.Connection = Depends(get_db)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Invalid authorization format")
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = crud.get_user(db, payload["user_id"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    authenticated_user_id.set(user["id"])
    return user


@router.post("/register")
@_rate_limit("10/minute")
def register(request: Request, req: RegisterRequest, db: sqlite3.Connection = Depends(get_db)):
    existing_name = crud.get_user_by_name(db, req.name)
    if existing_name:
        logger.warning("Register attempt with existing name", extra={"user_name": req.name})
        raise HTTPException(status_code=409, detail=f"User '{req.name}' already exists")
    existing_email = crud.get_user_by_email(db, req.email)
    if existing_email:
        logger.warning("Register attempt with existing email", extra={"email": req.email})
        raise HTTPException(status_code=409, detail="A user with this email already exists")
    pw_hash = hash_password(req.password)
    user_data = {
        "name": req.name,
        "email": req.email,
        "password_hash": pw_hash,
        "age": req.age,
        "gender": req.gender,
        "height_cm": req.height_cm,
        "weight_kg": req.weight_kg,
        "activity_level": req.activity_level,
        "goal": req.goal,
        "diet_type": req.diet_type,
    }
    bmr = calculate_bmr(req.weight_kg, req.height_cm, req.age, req.gender)
    tdee = calculate_tdee(bmr, req.activity_level)
    targets = calculate_targets(tdee, req.goal, req.weight_kg)
    user_data["bmr"] = bmr
    user_data["tdee"] = tdee
    user_data.update(targets)
    user = crud.create_user(db, user_data)
    token = create_access_token(user["id"], user["name"])
    logger.info("User registered", extra={"user_id": user["id"], "user_name": req.name, "email": req.email})
    auth_success_total.inc()
    return AuthResponse(status="success", token=token, user={"id": user["id"], "name": user["name"], "email": user.get("email", "")})


@router.post("/login")
@_rate_limit("10/minute")
def login(request: Request, req: LoginRequest, db: sqlite3.Connection = Depends(get_db)):
    user = crud.get_user_by_email(db, req.email)
    if not user:
        logger.warning("Login for unknown email", extra={"email": req.email})
        auth_failure_total.inc()
        raise HTTPException(status_code=404, detail="No account found with this email")
    if not verify_password(req.password, user.get("password_hash", "")):
        logger.warning("Invalid password login", extra={"email": req.email, "user_id": user["id"]})
        auth_failure_total.inc()
        raise HTTPException(status_code=401, detail="Invalid password")
    token = create_access_token(user["id"], user["name"])
    logger.info("User logged in", extra={"user_id": user["id"], "email": req.email})
    auth_success_total.inc()
    return AuthResponse(status="success", token=token, user={"id": user["id"], "name": user["name"], "email": user.get("email", "")})


@router.post("/forgot-password")
@_rate_limit("3/minute")
def forgot_password(request: Request, req: ForgotPasswordRequest, db: sqlite3.Connection = Depends(get_db)):
    user = crud.get_user_by_email(db, req.email)
    if not user:
        logger.info("Password reset requested for unknown email", extra={"email": req.email})
        return {"status": "success", "message": "If an account exists, a reset link has been sent"}
    crud.clean_expired_reset_tokens(db)
    token = generate_reset_token()
    expires_at = (datetime.utcnow() + timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")
    crud.create_password_reset_token(db, user["id"], token, expires_at)
    logger.info(
        "Password reset token generated",
        extra={"user_id": user["id"], "email": req.email, "reset_token": token},
    )
    return {
        "status": "success",
        "message": "If an account exists, a reset link has been sent",
    }


@router.post("/reset-password")
@_rate_limit("5/minute")
def reset_password(request: Request, req: ResetPasswordRequest, db: sqlite3.Connection = Depends(get_db)):
    record = crud.get_valid_reset_token(db, req.token)
    if not record:
        logger.warning("Invalid or expired reset token used")
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    pw_hash = hash_password(req.password)
    crud.update_user_password(db, record["user_id"], pw_hash)
    crud.mark_reset_token_used(db, req.token)
    logger.info("Password reset completed", extra={"user_id": record["user_id"]})
    return {"status": "success", "message": "Password has been reset successfully"}


@router.post("/logout")
def logout():
    return {"status": "success", "message": "Logged out (client should discard token)"}


@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    safe = {k: v for k, v in user.items() if k != "password_hash"}
    return {"status": "success", "user": safe}
