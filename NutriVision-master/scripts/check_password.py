"""Check stored password hash against demo123."""
import os
import sys

os.environ["NUTRIVISION_JWT_SECRET"] = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"
os.environ["NUTRIVISION_ENV"] = "development"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_connection

conn = get_connection()
cur = conn.cursor()
cur.execute("SELECT id, name, password_hash FROM users WHERE name='demo'")
row = cur.fetchone()
conn.close()

if not row:
    print("ERROR: demo user not found")
    exit(1)

pw_hash = row["password_hash"]
print("Hash:", repr(pw_hash))

from services.auth_service import verify_password
print("verify_password('demo123'):", verify_password("demo123", pw_hash))
print("verify_password('wrong'):", verify_password("wrong", pw_hash))
