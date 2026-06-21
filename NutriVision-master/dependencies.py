from fastapi import Header, HTTPException, Depends
from typing import Optional
import sqlite3
from database import get_db
import crud
from services.auth_service import decode_access_token
from logging_config import authenticated_user_id


def get_soft_user_id(
    authorization: Optional[str] = Header(None),
    db: sqlite3.Connection = Depends(get_db),
) -> int:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Invalid authorization format")
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    uid = payload.get("user_id")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = crud.get_user(db, uid)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    authenticated_user_id.set(user["id"])
    return user["id"]


def require_user_id(
    authorization: Optional[str] = Header(None),
    db: sqlite3.Connection = Depends(get_db),
) -> int:
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
    return user["id"]
