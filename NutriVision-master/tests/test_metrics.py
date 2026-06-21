"""Tests for the /metrics prometheus endpoint."""
import pytest
from fastapi.testclient import TestClient
from api import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


class TestMetricsEndpoint:
    def test_metrics_returns_200(self, client):
        resp = client.get("/metrics")
        assert resp.status_code == 200

    def test_metrics_content_type(self, client):
        resp = client.get("/metrics")
        assert resp.headers["content-type"].startswith("text/plain")

    def test_metrics_contains_nutrivision_prefix(self, client):
        resp = client.get("/metrics")
        text = resp.text
        assert "nutrivision_" in text

    def test_metrics_contains_request_count(self, client):
        resp = client.get("/metrics")
        assert "nutrivision_http_requests_total" in resp.text

    def test_metrics_contains_request_latency(self, client):
        resp = client.get("/metrics")
        assert "nutrivision_http_request_duration_seconds" in resp.text

    def test_metrics_contains_active_requests(self, client):
        resp = client.get("/metrics")
        assert "nutrivision_active_requests" in resp.text

    def test_metrics_contains_recommendation_latency(self, client):
        resp = client.get("/metrics")
        assert "nutrivision_recommendation_duration_seconds" in resp.text

    def test_metrics_contains_yolo_latency(self, client):
        resp = client.get("/metrics")
        assert "nutrivision_yolo_inference_duration_seconds" in resp.text

    def test_metrics_contains_auth_counters(self, client):
        resp = client.get("/metrics")
        assert "nutrivision_auth_success_total" in resp.text
        assert "nutrivision_auth_failure_total" in resp.text

    def test_metrics_updated_after_request(self, client):
        client.get("/health")
        resp = client.get("/metrics")
        assert "nutrivision_http_requests_total" in resp.text
