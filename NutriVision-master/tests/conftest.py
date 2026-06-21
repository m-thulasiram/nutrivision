import os
import tempfile

os.environ.setdefault("NUTRIVISION_JWT_SECRET", "test-secret-that-is-at-least-thirtytwo-chars-long")
os.environ.setdefault("NUTRIVISION_ENV", "test")
os.environ.setdefault("NUTRIVISION_CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("DISABLE_RATE_LIMIT", "1")

_default_db = os.path.join(tempfile.gettempdir(), "nutrivision_test.db")
os.environ.setdefault("NUTRIVISION_DB_URL", _default_db)

import pytest

from database import get_connection, IS_POSTGRES, config

# Initialize schema once at module level
if not IS_POSTGRES:
    try:
        os.remove(config.db_url)
    except OSError:
        pass

from database import init_db as _init_db
_init_db()


@pytest.fixture(scope="session")
def _shared_conn():
    conn = get_connection()
    yield conn
    conn.close()


@pytest.fixture(autouse=True)
def clear_tables(_shared_conn):
    conn = _shared_conn
    cur = conn.cursor()
    tables = ["password_reset_tokens", "daily_logs", "meal_logs", "users"]
    if IS_POSTGRES:
        cur.execute(
            "TRUNCATE TABLE password_reset_tokens, daily_logs, meal_logs, users RESTART IDENTITY CASCADE"
        )
    else:
        for t in tables:
            try:
                cur.execute(f"DELETE FROM {t}")
            except Exception:
                pass
        try:
            cur.execute("DELETE FROM sqlite_sequence")
        except Exception:
            pass
    conn.commit()
    yield


@pytest.fixture
def db_conn(_shared_conn):
    yield _shared_conn


@pytest.fixture
def sample_user_data():
    return {
        "name": "TestUser",
        "email": "testuser@test.com",
        "age": 25,
        "gender": "Male",
        "height_cm": 175.0,
        "weight_kg": 70.0,
        "activity_level": "moderate",
        "goal": "maintain",
        "bmr": 1695.75,
        "tdee": 2628.41,
        "target_calories": 2628.41,
        "target_protein": 197.13,
        "target_carbs": 262.84,
        "target_fats": 87.61,
    }
