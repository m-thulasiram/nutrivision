import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from api import app
from database import get_connection
import crud
from services.auth_service import hash_password, create_access_token

@pytest.fixture
def test_client():
    with TestClient(app) as c:
        yield c

@pytest.fixture
def auth_headers():
    conn = get_connection()
    pw_hash = hash_password("secure123")
    user = crud.create_user(conn, {
        "name": "CopilotUser", "email": "copilot@test.com", "password_hash": pw_hash,
        "age": 28, "gender": "male",
        "height_cm": 175, "weight_kg": 75,
        "activity_level": "moderate", "goal": "maintain",
        "bmr": 1600.0, "tdee": 2400.0,
        "target_calories": 2400.0, "target_protein": 140.0,
        "target_carbs": 260.0, "target_fats": 75.0,
        "preferred_state": "Tamil Nadu", "diet_type": "vegetarian"
    })
    conn.commit()
    conn.close()
    token = create_access_token(user["id"], "CopilotUser")
    return {"Authorization": f"Bearer {token}"}

def test_copilot_chat_mock_fallback(test_client, auth_headers):
    # Test that /api/copilot/chat falls back to mock stream when OpenAI API key is missing
    resp = test_client.post(
        "/api/copilot/chat",
        json={"message": "What should I eat for lunch?", "conversation_history": []},
        headers=auth_headers
    )
    assert resp.status_code == 200
    content = resp.text
    assert "data: {" in content
    assert "protein" in content.lower() or "kcal" in content.lower() or "budget" in content.lower()

def test_copilot_chat_exception_fallback(test_client, auth_headers):
    # Mock stream_copilot_response to raise an exception and mock API key present.
    # This triggers the exception handler in routes/copilot.py to fall back to mock stream.
    # With the logger bug fixed, this should succeed and not raise NameError.
    with patch("routes.copilot.stream_copilot_response", side_effect=Exception("Simulated OpenAI error")):
        with patch("routes.copilot.os.getenv", return_value="mocked_key"):
            resp = test_client.post(
                "/api/copilot/chat",
                json={"message": "What should I eat for lunch?", "conversation_history": []},
                headers=auth_headers
            )
            assert resp.status_code == 200
            content = resp.text
            assert "data: {" in content
            assert "protein" in content.lower()

def test_copilot_log_meal(test_client, auth_headers):
    # Test logging a meal through the copilot endpoint
    resp = test_client.post(
        "/api/copilot/log-meal",
        json={
            "food_name": "Idli Sambar Tamilnadu",
            "calories": 150,
            "protein_g": 5,
            "carbs_g": 30,
            "fats_g": 1
        },
        headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "logged" in data
    assert data["logged"]["food_name"] == "Idli Sambar Tamilnadu"
