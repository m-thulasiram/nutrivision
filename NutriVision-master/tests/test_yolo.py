"""Tests for YOLO analyze endpoint with mocked detection."""
import pytest
import io
from PIL import Image
from fastapi.testclient import TestClient

from database import get_connection
from api import app


class MockTensor:
    def __init__(self, val):
        self._val = val
    def item(self):
        return self._val
    def __float__(self):
        return float(self._val)
    def __int__(self):
        return int(self._val)
    def __sub__(self, other):
        ov = other._val if isinstance(other, MockTensor) else other
        return self._val - ov
    def __rsub__(self, other):
        return other - self._val


class MockBox:
    def __init__(self):
        self.xyxyn = [[MockTensor(0.1), MockTensor(0.1), MockTensor(0.3), MockTensor(0.3)]]
        self.cls = [MockTensor(0)]
        self.conf = [MockTensor(0.95)]


class MockResult:
    def __init__(self):
        self.boxes = [MockBox()]


class MockYOLOModel:
    names = {0: "Bananas"}

    def __call__(self, image):
        return [MockResult()]

    def predict(self, *args, **kwargs):
        return [MockResult()]


@pytest.fixture(autouse=True)
def patch_yolo():
    import models as _models
    _models.get_models()
    original = _models._instance.yolo_model
    _models._instance.yolo_model = MockYOLOModel()
    yield
    _models._instance.yolo_model = original


@pytest.fixture(autouse=True)
def reset_test_db():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM daily_logs")
    cur.execute("DELETE FROM meal_logs")
    cur.execute("DELETE FROM workout_logs")
    cur.execute("DELETE FROM workout_plans")
    cur.execute("DELETE FROM users")
    conn.commit()
    conn.close()
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth_headers(client):
    resp = client.post("/api/auth/register", json={
        "name": "TestUser", "email": "testuser@test.com", "password": "test123",
        "age": 30, "gender": "Male",
        "height_cm": 175, "weight_kg": 70,
        "activity_level": "moderate", "goal": "maintain"
    })
    assert resp.status_code == 200
    token = resp.json()["token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def fake_image():
    img = Image.new("RGB", (100, 100), color="red")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf


class TestYOLOMocked:
    def test_analyze_with_mock_returns_success(self, client, auth_headers, fake_image):
        resp = client.post(
            "/api/analyze-meal",
            headers=auth_headers,
            files={"image": ("test.jpg", fake_image, "image/jpeg")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"

    def test_analyze_detects_items(self, client, auth_headers, fake_image):
        resp = client.post(
            "/api/analyze-meal",
            headers=auth_headers,
            files={"image": ("test.jpg", fake_image, "image/jpeg")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data.get("detected_items", [])) > 0
        assert data.get("total_calories", 0) > 0

    def test_analyze_logs_meal(self, client, auth_headers, fake_image):
        resp = client.post(
            "/api/analyze-meal",
            headers=auth_headers,
            files={"image": ("test.jpg", fake_image, "image/jpeg")},
        )
        assert resp.status_code == 200
        conn = get_connection()
        count = conn.cursor().execute(
            "SELECT COUNT(*) AS cnt FROM meal_logs WHERE user_id = "
            "(SELECT id FROM users WHERE name = 'TestUser')"
        ).fetchone()
        conn.close()
        assert count["cnt"] > 0

    def test_analyze_has_macro_distribution(self, client, auth_headers, fake_image):
        resp = client.post(
            "/api/analyze-meal",
            headers=auth_headers,
            files={"image": ("test.jpg", fake_image, "image/jpeg")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "macro_distribution" in data
        md = data["macro_distribution"]
        assert "calories" in md
        assert "protein" in md
        assert "carbs" in md
        assert "fat" in md

    def test_analyze_has_confidence_scores(self, client, auth_headers, fake_image):
        resp = client.post(
            "/api/analyze-meal",
            headers=auth_headers,
            files={"image": ("test.jpg", fake_image, "image/jpeg")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data.get("confidence_scores", [])) > 0

    def test_analyze_creates_daily_log(self, client, auth_headers, fake_image):
        resp = client.post(
            "/api/analyze-meal",
            headers=auth_headers,
            files={"image": ("test.jpg", fake_image, "image/jpeg")},
        )
        assert resp.status_code == 200
        conn = get_connection()
        count = conn.cursor().execute(
            "SELECT COUNT(*) AS cnt FROM daily_logs WHERE user_id = "
            "(SELECT id FROM users WHERE name = 'TestUser')"
        ).fetchone()
        conn.close()
        assert count["cnt"] > 0
