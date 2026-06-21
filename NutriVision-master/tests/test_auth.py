"""Integration tests for auth endpoints (/api/auth/*)."""
import pytest
from fastapi.testclient import TestClient

from database import get_connection, IS_POSTGRES
from api import app


@pytest.fixture(autouse=True)
def reset_test_db():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM password_reset_tokens")
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


REGISTER_ALICE = {
    "name": "Alice", "email": "alice@test.com", "password": "secure123",
    "age": 28, "gender": "Female",
    "height_cm": 165, "weight_kg": 60,
    "activity_level": "active", "goal": "weight_loss"
}

REGISTER_BOB = {
    "name": "Bob", "email": "bob@test.com", "password": "test456",
    "age": 35, "gender": "Male",
    "height_cm": 180, "weight_kg": 85,
    "activity_level": "moderate", "goal": "muscle_gain"
}


class TestAuthRegister:
    def test_register_success(self, client):
        resp = client.post("/api/auth/register", json=REGISTER_ALICE)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert "token" in data
        assert data["user"]["name"] == "Alice"
        assert data["user"]["id"] > 0

    def test_register_duplicate(self, client):
        client.post("/api/auth/register", json=REGISTER_ALICE)
        resp = client.post("/api/auth/register", json=REGISTER_ALICE)
        assert resp.status_code == 409
        assert "already" in resp.json()["detail"].lower()

    def test_register_short_password(self, client):
        resp = client.post("/api/auth/register", json={
            "name": "Bob", "email": "bob@test.com", "password": "12345",
            "age": 30, "gender": "Male",
            "height_cm": 175, "weight_kg": 70,
            "activity_level": "moderate", "goal": "maintain"
        })
        assert resp.status_code == 422


class TestAuthLogin:
    def test_login_success(self, client):
        client.post("/api/auth/register", json=REGISTER_ALICE)
        resp = client.post("/api/auth/login", json={
            "email": "alice@test.com", "password": "secure123"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert "token" in data

    def test_login_wrong_password(self, client):
        client.post("/api/auth/register", json=REGISTER_ALICE)
        resp = client.post("/api/auth/login", json={
            "email": "alice@test.com", "password": "wrongpass"
        })
        assert resp.status_code == 401

    def test_login_not_found(self, client):
        resp = client.post("/api/auth/login", json={
            "email": "nobody@test.com", "password": "whatever"
        })
        assert resp.status_code == 404


class TestAuthMe:
    def test_me_authenticated(self, client):
        reg = client.post("/api/auth/register", json=REGISTER_ALICE)
        token = reg.json()["token"]
        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["user"]["name"] == "Alice"
        assert resp.json()["user"]["id"] > 0

    def test_me_no_token(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_me_invalid_token(self, client):
        resp = client.get("/api/auth/me", headers={"Authorization": "Bearer invalidtoken"})
        assert resp.status_code == 401

    def test_me_expired_token_returns_detail(self, client):
        import services.auth_service as svc
        orig = svc.JWT_EXPIRY_HOURS
        svc.JWT_EXPIRY_HOURS = -1
        try:
            old_token = svc.create_access_token(1, "Alice")
            resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {old_token}"})
            assert resp.status_code == 401
        finally:
            svc.JWT_EXPIRY_HOURS = orig


class TestAuthLogout:
    def test_logout_success(self, client):
        reg = client.post("/api/auth/register", json=REGISTER_ALICE)
        token = reg.json()["token"]
        resp = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "success"

    def test_logout_no_token(self, client):
        resp = client.post("/api/auth/logout")
        assert resp.status_code == 200
        assert resp.json()["status"] == "success"


class TestAuthForgotPassword:
    def test_forgot_password_existing_user(self, client):
        client.post("/api/auth/register", json=REGISTER_ALICE)
        resp = client.post("/api/auth/forgot-password", json={
            "email": "alice@test.com"
        })
        assert resp.status_code == 200
        assert resp.json()["status"] == "success"

    def test_forgot_password_unknown_user(self, client):
        resp = client.post("/api/auth/forgot-password", json={
            "email": "nobody@test.com"
        })
        assert resp.status_code == 200
        assert resp.json()["status"] == "success"

    def test_forgot_password_invalid_email(self, client):
        resp = client.post("/api/auth/forgot-password", json={
            "email": "notanemail"
        })
        assert resp.status_code == 422


class TestAuthResetPassword:
    def test_reset_password_success(self, client):
        reg = client.post("/api/auth/register", json=REGISTER_ALICE)
        assert reg.status_code == 200
        alice_id = reg.json()["user"]["id"]

        fp = client.post("/api/auth/forgot-password", json={"email": "alice@test.com"})
        assert fp.status_code == 200

        ph = "%s" if IS_POSTGRES else "?"
        conn = get_connection()
        row = conn.cursor().execute(
            f"SELECT token FROM password_reset_tokens WHERE user_id = {ph} ORDER BY id DESC LIMIT 1",
            (alice_id,)
        ).fetchone()
        conn.close()
        assert row is not None
        token = row["token"]

        resp = client.post("/api/auth/reset-password", json={
            "token": token,
            "password": "newpassword123"
        })
        assert resp.status_code == 200
        assert resp.json()["status"] == "success"

        login_resp = client.post("/api/auth/login", json={
            "email": "alice@test.com", "password": "newpassword123"
        })
        assert login_resp.status_code == 200

    def test_reset_password_invalid_token(self, client):
        resp = client.post("/api/auth/reset-password", json={
            "token": "invalidtoken",
            "password": "newpassword123"
        })
        assert resp.status_code == 400
        assert "Invalid or expired" in resp.json()["detail"]

    def test_reset_password_short_password(self, client):
        resp = client.post("/api/auth/reset-password", json={
            "token": "sometoken",
            "password": "12345"
        })
        assert resp.status_code == 422

    def test_reset_token_used_once(self, client):
        reg = client.post("/api/auth/register", json=REGISTER_ALICE)
        alice_id = reg.json()["user"]["id"]

        client.post("/api/auth/forgot-password", json={"email": "alice@test.com"})

        ph = "%s" if IS_POSTGRES else "?"
        conn = get_connection()
        row = conn.cursor().execute(
            f"SELECT token FROM password_reset_tokens WHERE user_id = {ph} ORDER BY id DESC LIMIT 1",
            (alice_id,)
        ).fetchone()
        conn.close()
        assert row is not None
        token = row["token"]

        resp1 = client.post("/api/auth/reset-password", json={
            "token": token,
            "password": "newpass456"
        })
        assert resp1.status_code == 200

        resp2 = client.post("/api/auth/reset-password", json={
            "token": token,
            "password": "anotherpass789"
        })
        assert resp2.status_code == 400
