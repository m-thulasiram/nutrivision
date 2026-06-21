"""Create a demo user for testing."""
import os
import sys
import sqlite3

os.environ["NUTRIVISION_JWT_SECRET"] = "demo-secret-key-that-is-at-least-thirtytwo-chars"
os.environ["NUTRIVISION_ENV"] = "development"
os.environ["NUTRIVISION_CORS_ORIGINS"] = "http://localhost:5173,http://localhost:3000"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import init_db, get_connection
from services.auth_service import hash_password, create_access_token
import crud

init_db()

conn = get_connection()

demo = crud.get_user_by_name(conn, "demo")
if demo:
    print("Demo user already exists (id=%d)" % demo["id"])
else:
    pw_hash = hash_password("demo123")
    user = crud.create_user(conn, {
        "name": "demo",
        "password_hash": pw_hash,
        "age": 28,
        "gender": "male",
        "height_cm": 170,
        "weight_kg": 65,
        "activity_level": "moderate",
        "goal": "maintain",
        "bmr": 1600,
        "tdee": 2481,
        "target_calories": 2481,
        "target_protein": 186,
        "target_carbs": 248,
        "target_fats": 83,
    })
    token = create_access_token(user["id"], "demo")
    print("Demo user created! id=%d" % user["id"])

conn.close()
print()
print("=== DEMO LOGIN ===")
print("name:     demo")
print("password: demo123")
print()
print("POST /api/auth/login  {\"name\":\"demo\",\"password\":\"demo123\"}")
