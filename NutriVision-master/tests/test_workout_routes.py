import pytest
from fastapi.testclient import TestClient
from api import app

client = TestClient(app)


def _register_user(name="workouttest", email="workout@test.com"):
    res = client.post("/api/auth/register", json={
        "name": name, "email": email, "password": "secret123",
        "age": 30, "gender": "male", "height_cm": 175, "weight_kg": 70,
        "activity_level": "moderate", "goal": "maintain",
    })
    data = res.json()
    return data["token"], data["user"]["id"]


def test_get_exercises():
    res = client.get("/api/workouts/exercises")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert len(data["exercises"]) > 0
    assert "name" in data["exercises"][0]
    assert "muscle_group" in data["exercises"][0]


def test_get_exercises_filtered():
    res = client.get("/api/workouts/exercises?muscle_group=chest")
    assert res.status_code == 200
    data = res.json()
    for ex in data["exercises"]:
        assert ex["muscle_group"] == "chest"


def test_generate_plan():
    token, uid = _register_user("planuser", "plan@test.com")
    res = client.post("/api/workouts/plans", json={"equipment": "bodyweight"},
                       headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "plan" in data


def test_get_plan():
    token, uid = _register_user("getplanuser", "getplan@test.com")
    client.post("/api/workouts/plans", json={"equipment": "bodyweight"},
                headers={"Authorization": f"Bearer {token}"})
    res = client.get("/api/workouts/plans", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"


def test_log_workout():
    token, uid = _register_user("loguser", "log@test.com")
    res = client.post("/api/workouts/log", json={
        "exercise_name": "Push Up", "sets": 3, "reps": 10,
        "duration_minutes": 15, "calories_burned": 50,
    }, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "id" in data


def test_get_workout_logs():
    token, uid = _register_user("loghistory", "loghist@test.com")
    client.post("/api/workouts/log", json={
        "exercise_name": "Squat", "sets": 4, "reps": 12,
        "duration_minutes": 20, "calories_burned": 80,
    }, headers={"Authorization": f"Bearer {token}"})
    res = client.get("/api/workouts/logs", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert len(data["logs"]) >= 1
    assert data["total"] >= 1


def test_log_workout_unauthorized():
    res = client.post("/api/workouts/log", json={
        "exercise_name": "Push Up", "sets": 3, "reps": 10,
    })
    assert res.status_code == 401
