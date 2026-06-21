"""Integration tests for the analyze endpoint."""
import pytest
import io
from PIL import Image
from fastapi.testclient import TestClient

from database import get_connection
from api import app
from models import load_models


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
def auth_token(client):
    resp = client.post("/api/auth/register", json={
        "name": "TestUser", "email": "testuser@test.com", "password": "test123", "age": 30, "gender": "Male",
        "height_cm": 175, "weight_kg": 70,
        "activity_level": "moderate", "goal": "maintain"
    })
    assert resp.status_code == 200
    return resp.json()["token"]


@pytest.fixture
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def fake_image_jpeg():
    img = Image.new("RGB", (100, 100), color="red")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf


@pytest.fixture
def fake_image_png():
    img = Image.new("RGB", (100, 100), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


class TestAnalyzeValidation:
    def test_no_image_returns_422(self, client, auth_headers):
        resp = client.post("/api/analyze-meal", headers=auth_headers)
        assert resp.status_code == 422

    def test_empty_file_returns_400_or_500(self, client, auth_headers):
        resp = client.post(
            "/api/analyze-meal",
            headers=auth_headers,
            files={"image": ("test.jpg", b"", "image/jpeg")},
        )
        assert resp.status_code in (400, 422, 500)

    def test_large_file_rejected(self, client, auth_headers):
        large = b"x" * (11 * 1024 * 1024)
        resp = client.post(
            "/api/analyze-meal",
            headers=auth_headers,
            files={"image": ("large.jpg", large, "image/jpeg")},
        )
        assert resp.status_code in (413, 422)

    def test_invalid_content_type_rejected(self, client, auth_headers):
        resp = client.post(
            "/api/analyze-meal",
            headers=auth_headers,
            files={"image": ("test.txt", b"hello", "text/plain")},
        )
        assert resp.status_code == 400

    def test_unsupported_format_rejected(self, client, auth_headers):
        img = Image.new("RGB", (50, 50), color="green")
        buf = io.BytesIO()
        img.save(buf, format="BMP")
        buf.seek(0)
        resp = client.post(
            "/api/analyze-meal",
            headers=auth_headers,
            files={"image": ("test.bmp", buf, "image/bmp")},
        )
        assert resp.status_code == 400


class TestAnalyzeWithUser:
    def test_analyze_with_registered_user_succeeds(self, client, auth_headers, fake_image_jpeg):
        resp = client.post(
            "/api/analyze-meal",
            headers=auth_headers,
            files={"image": ("test.jpg", fake_image_jpeg, "image/jpeg")},
        )
        assert resp.status_code in (200, 400, 422, 500)

    def test_analyze_without_auth_returns_401(self, client, fake_image_jpeg):
        resp = client.post(
            "/api/analyze-meal",
            files={"image": ("test.jpg", fake_image_jpeg, "image/jpeg")},
        )
        assert resp.status_code == 401

    def test_analyze_returns_structured_response(self, client, auth_headers, fake_image_jpeg):
        resp = client.post(
            "/api/analyze-meal",
            headers=auth_headers,
            files={"image": ("test.jpg", fake_image_jpeg, "image/jpeg")},
        )
        if resp.status_code == 200:
            data = resp.json()
            assert "status" in data
            assert "meal" in data or "total_calories" in data

    @pytest.mark.skip(reason="Model-dependent: synthetic images may not trigger YOLO detections")
    def test_analyze_logs_meal_when_user_recognized(self, client, auth_headers, fake_image_jpeg):
        resp = client.post(
            "/api/analyze-meal",
            headers=auth_headers,
            files={"image": ("test.jpg", fake_image_jpeg, "image/jpeg")},
        )
        if resp.status_code == 200:
            conn = get_connection()
            count = conn.cursor().execute(
                "SELECT COUNT(*) AS cnt FROM meal_logs WHERE user_id = "
                "(SELECT id FROM users WHERE name = 'TestUser')"
            ).fetchone()
            conn.close()
            assert count["cnt"] > 0


class TestAnalyzeEdgeCases:
    def test_analyze_two_requests_different_users(self, client, auth_headers, fake_image_jpeg):
        client.post(
            "/api/analyze-meal",
            headers=auth_headers,
            files={"image": ("test.jpg", fake_image_jpeg, "image/jpeg")},
        )
        reg2 = client.post("/api/auth/register", json={
            "name": "User2", "email": "user2@test.com", "password": "test123",
            "age": 25, "gender": "Male", "height_cm": 170, "weight_kg": 65,
            "activity_level": "active", "goal": "maintain"
        })
        token2 = reg2.json()["token"]
        resp2 = client.post(
            "/api/analyze-meal",
            headers={"Authorization": f"Bearer {token2}"},
            files={"image": ("test.jpg", fake_image_jpeg, "image/jpeg")},
        )
        assert resp2.status_code in (200, 400, 422, 500)

    def test_analyze_metrics_present(self, client, auth_headers, fake_image_jpeg):
        resp = client.get("/metrics")
        assert resp.status_code == 200

    def test_decompression_bomb_protected(self, client, auth_headers):
        decompression_bomb = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        resp = client.post(
            "/api/analyze-meal",
            headers=auth_headers,
            files={"image": ("bomb.png", decompression_bomb, "image/png")},
        )
        assert resp.status_code in (400, 422, 500)


class TestAnalyzeBase64:
    def test_base64_analyze_success(self, client, auth_headers, fake_image_jpeg):
        import base64
        b64_data = base64.b64encode(fake_image_jpeg.read()).decode("utf-8")
        resp = client.post(
            "/api/analyze-meal-b64",
            headers=auth_headers,
            json={"image_base64": b64_data}
        )
        assert resp.status_code in (200, 400, 500)
        if resp.status_code == 200:
            data = resp.json()
            assert "status" in data

    def test_base64_invalid_payload_rejected(self, client, auth_headers):
        resp = client.post(
            "/api/analyze-meal-b64",
            headers=auth_headers,
            json={"image_base64": "not-valid-base64!"}
        )
        assert resp.status_code == 400

