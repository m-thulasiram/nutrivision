import bcrypt
import jwt
import secrets
import time
from typing import Optional
from config import config

JWT_SECRET = config.jwt_secret
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = config.jwt_expiration_hours

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))

def create_access_token(user_id: int, name: str) -> str:
    payload = {
        "user_id": user_id,
        "name": name,
        "exp": int(time.time()) + JWT_EXPIRY_HOURS * 3600,
        "iat": int(time.time())
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
