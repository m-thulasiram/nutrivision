"""Tests for middleware classes: Observability, Security Headers, HTTPS Redirect."""
import pytest
from fastapi.testclient import TestClient
from api import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


class TestObservabilityMiddleware:
    def test_response_has_request_id(self, client):
        resp = client.get("/health")
        assert "X-Request-ID" in resp.headers
        assert len(resp.headers["X-Request-ID"]) == 12

    def test_response_has_correlation_id(self, client):
        resp = client.get("/health")
        assert "X-Correlation-ID" in resp.headers

    def test_correlation_id_from_request(self, client):
        resp = client.get("/health", headers={"X-Correlation-ID": "my-custom-cid"})
        assert resp.headers["X-Correlation-ID"] == "my-custom-cid"

    def test_correlation_id_generated_if_not_provided(self, client):
        resp = client.get("/health")
        assert len(resp.headers["X-Correlation-ID"]) == 16

    def test_metrics_endpoint_also_has_headers(self, client):
        resp = client.get("/metrics")
        assert "X-Request-ID" in resp.headers
        assert "X-Correlation-ID" in resp.headers


class TestSecurityHeadersMiddleware:
    def test_has_csp_header(self, client):
        resp = client.get("/health")
        assert "Content-Security-Policy" in resp.headers
        csp = resp.headers["Content-Security-Policy"]
        assert "default-src 'self'" in csp

    def test_has_strict_transport_security(self, client):
        resp = client.get("/health")
        assert "Strict-Transport-Security" in resp.headers
        assert "max-age=31536000" in resp.headers["Strict-Transport-Security"]

    def test_has_x_frame_options(self, client):
        resp = client.get("/health")
        assert resp.headers["X-Frame-Options"] == "DENY"

    def test_has_x_content_type_options(self, client):
        resp = client.get("/health")
        assert resp.headers["X-Content-Type-Options"] == "nosniff"

    def test_has_referrer_policy(self, client):
        resp = client.get("/health")
        assert "Referrer-Policy" in resp.headers

    def test_has_xss_protection(self, client):
        resp = client.get("/health")
        assert "X-XSS-Protection" in resp.headers

    def test_has_permissions_policy(self, client):
        resp = client.get("/health")
        assert "Permissions-Policy" in resp.headers
        assert "camera=()" in resp.headers["Permissions-Policy"]

    def test_auth_routes_have_no_cache(self, client):
        resp = client.get("/health")
        assert "Cache-Control" not in resp.headers


class TestHTTPSRedirectMiddleware:
    def test_http_forwarded_proto_redirects(self, client):
        resp = client.get("/health", headers={"X-Forwarded-Proto": "http"}, follow_redirects=False)
        assert resp.status_code == 301
        assert resp.headers["Location"].startswith("https://")

    def test_https_no_redirect(self, client):
        resp = client.get("/health", headers={"X-Forwarded-Proto": "https"})
        assert resp.status_code == 200

    def test_no_header_no_redirect(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
