"""Tests for the auth service layer (hashing, JWT)."""
import pytest
from services.auth_service import hash_password, verify_password, create_access_token, decode_access_token


class TestPasswordHashing:
    def test_hash_and_verify(self):
        pw = "mysecret123"
        hashed = hash_password(pw)
        assert hashed != pw
        assert verify_password(pw, hashed) is True

    def test_wrong_password_fails(self):
        hashed = hash_password("realpass")
        assert verify_password("wrongpass", hashed) is False

    def test_different_hashes_same_password(self):
        """Each call should produce a different hash (salt is random)."""
        h1 = hash_password("password")
        h2 = hash_password("password")
        assert h1 != h2
        # Both should verify correctly
        assert verify_password("password", h1) is True
        assert verify_password("password", h2) is True

    def test_empty_password(self):
        hashed = hash_password("")
        assert verify_password("", hashed) is True
        assert verify_password("x", hashed) is False


class TestJWT:
    def test_create_and_decode(self):
        token = create_access_token(1, "Alice")
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["user_id"] == 1
        assert payload["name"] == "Alice"
        assert "exp" in payload
        assert "iat" in payload

    def test_invalid_token_returns_none(self):
        assert decode_access_token("not.a.token") is None

    def test_modified_token_returns_none(self):
        token = create_access_token(1, "Alice")
        parts = token.rsplit(".", 1)
        tampered = parts[0] + ".tampered"
        assert decode_access_token(tampered) is None

    def test_expired_token_returns_none(self, monkeypatch):
        import services.auth_service as svc
        with monkeypatch.context() as m:
            m.setattr(svc, "JWT_EXPIRY_HOURS", -1)
            token = svc.create_access_token(1, "Alice")
        assert decode_access_token(token) is None
