import pytest
from fastapi.testclient import TestClient
from api import app

client = TestClient(app)

_register_used = False


def _get_token():
    global _register_used
    suffix = "smartrec1"
    name = f"smart_{suffix}"
    email = f"{suffix}@test.com"
    res = client.post("/api/auth/register", json={
        "name": name, "email": email, "password": "secret123",
        "age": 30, "gender": "male", "height_cm": 175, "weight_kg": 70,
        "activity_level": "moderate", "goal": "maintain",
    })
    data = res.json()
    _register_used = True
    return data["token"]


def test_smart_recommendation_endpoint():
    token = _get_token()
    res = client.get("/api/users/me/next-meal-recommendation",
                      headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert "remaining_calories" in data
    assert "remaining_macros" in data
    assert "deficit_reason" in data
    assert "suggested_meals" in data


def test_smart_recommendation_unauthorized():
    res = client.get("/api/users/me/next-meal-recommendation")
    assert res.status_code == 401


def test_diet_type_register():
    res = client.post("/api/auth/register", json={
        "name": "dietuser", "email": "diettype@test.com", "password": "secret123",
        "age": 25, "gender": "female", "height_cm": 165, "weight_kg": 60,
        "activity_level": "active", "goal": "muscle_gain", "diet_type": "eggetarian",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"


def test_diet_type_invalid():
    res = client.post("/api/auth/register", json={
        "name": "baddiet", "email": "baddiet@test.com", "password": "secret123",
        "age": 25, "gender": "female", "height_cm": 165, "weight_kg": 60,
        "activity_level": "active", "goal": "maintain", "diet_type": "invalid",
    })
    assert res.status_code == 422
