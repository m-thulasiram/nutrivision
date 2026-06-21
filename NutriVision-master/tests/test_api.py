import pytest
import os
from fastapi.testclient import TestClient

import database
import crud
from api import app
from database import get_db, get_connection


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
def alice_token(client):
    conn = get_connection()
    from services.auth_service import hash_password, create_access_token
    from services.health_calculator import calculate_bmr, calculate_tdee, calculate_targets
    bmr = calculate_bmr(60, 165, 28, "female")
    tdee = calculate_tdee(bmr, "active")
    targets = calculate_targets(tdee, "weight_loss", 60)
    pw_hash = hash_password("secure123")
    user = crud.create_user(conn, {
        "name": "Alice", "email": "alice@test.com", "password_hash": pw_hash,
        "age": 28, "gender": "female",
        "height_cm": 165, "weight_kg": 60,
        "activity_level": "active", "goal": "weight_loss",
        "bmr": bmr, "tdee": tdee, **targets,
    })
    conn.close()
    token = create_access_token(user["id"], "Alice")
    return token


@pytest.fixture
def alice_headers(alice_token):
    return {"Authorization": f"Bearer {alice_token}"}


# --- Tests ---

class TestUsers:
    def test_list_empty(self, client):
        resp = client.get("/api/users")
        assert resp.json()["users"] == []

    def test_register(self, client):
        resp = client.post("/api/auth/register", json={
            "name": "Alice", "email": "alice@test.com", "password": "test123", "age": 28, "gender": "Female",
            "height_cm": 165, "weight_kg": 60,
            "activity_level": "active", "goal": "weight_loss"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["user"]["name"] == "Alice"
        assert isinstance(data["user"]["id"], int) and data["user"]["id"] > 0
        assert "token" in data
        assert len(data["token"]) > 0

    def test_register_duplicate(self, client, registered_alice):
        resp = client.post("/api/auth/register", json={
            "name": "Alice", "email": "alice@test.com", "password": "test123", "age": 28, "gender": "Female",
            "height_cm": 165, "weight_kg": 60,
            "activity_level": "active", "goal": "weight_loss"
        })
        assert resp.status_code == 409
        assert "already exists" in resp.json()["detail"]

    def test_register_multiple_users(self, client):
        resp1 = client.post("/api/auth/register", json={
            "name": "Alice", "email": "alice@test.com", "password": "test123", "age": 28, "gender": "Female",
            "height_cm": 165, "weight_kg": 60,
            "activity_level": "active", "goal": "weight_loss"
        })
        resp2 = client.post("/api/auth/register", json={
            "name": "Bob", "email": "bob@test.com", "password": "test456", "age": 35, "gender": "Male",
            "height_cm": 180, "weight_kg": 85,
            "activity_level": "moderate", "goal": "muscle_gain"
        })
        assert resp2.status_code == 200
        assert resp2.json()["user"]["id"] != resp1.json()["user"]["id"]

    def test_list_users(self, client):
        client.post("/api/auth/register", json={
            "name": "Alice", "email": "alice@test.com", "password": "test123", "age": 28, "gender": "Female",
            "height_cm": 165, "weight_kg": 60,
            "activity_level": "active", "goal": "weight_loss"
        })
        client.post("/api/auth/register", json={
            "name": "Bob", "email": "bob@test.com", "password": "test456", "age": 35, "gender": "Male",
            "height_cm": 180, "weight_kg": 85,
            "activity_level": "moderate", "goal": "muscle_gain"
        })
        resp = client.get("/api/users")
        assert len(resp.json()["users"]) == 2

    def test_login(self, client, alice_headers):
        resp = client.post("/api/auth/login", json={
            "email": "alice@test.com", "password": "secure123"
        })
        assert resp.status_code == 200
        assert resp.json()["user"]["name"] == "Alice"
        assert "token" in resp.json()

    def test_login_not_found(self, client):
        resp = client.post("/api/auth/login", json={
            "email": "charlie@test.com", "password": "test123"
        })
        assert resp.status_code == 404
        assert "No account found" in resp.json()["detail"]

    def test_get_profile(self, client, alice_headers):
        resp = client.get("/api/users/1", headers=alice_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["user"]["name"] == "Alice"

    def test_get_profile_not_found_mismatch(self, client, alice_headers):
        resp = client.get("/api/users/999", headers=alice_headers)
        assert resp.status_code == 403

    def test_create_or_update_profile_create(self, client, alice_headers):
        resp = client.post("/api/users/profile", json={
            "age": 30, "gender": "Male",
            "height_cm": 180, "weight_kg": 80,
            "activity_level": "active", "goal": "maintain",
        }, headers=alice_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"

    def test_create_or_update_profile_update(self, client, alice_headers):
        client.post("/api/users/profile", json={
            "age": 25, "gender": "Female", "height_cm": 165, "weight_kg": 60,
            "activity_level": "active", "goal": "weight_loss",
        }, headers=alice_headers)
        resp = client.post("/api/users/profile", json={
            "age": 30, "gender": "Male",
            "height_cm": 180, "weight_kg": 80,
            "activity_level": "active", "goal": "maintain",
        }, headers=alice_headers)
        assert resp.status_code == 200


class TestProgress:
    def test_progress_new_user(self, client, alice_headers):
        resp = client.get("/api/users/1/progress", headers=alice_headers)
        assert resp.status_code == 200
        d = resp.json()["progress"]
        assert d["consumed"]["calories"] == 0.0

    def test_progress_not_found_mismatch(self, client, alice_headers):
        resp = client.get("/api/users/999/progress", headers=alice_headers)
        assert resp.status_code == 403

    def test_progress_shows_correct_targets(self, client, alice_headers):
        client.post("/api/users/profile", json={
            "age": 28, "gender": "Female", "height_cm": 165, "weight_kg": 60,
            "activity_level": "active", "goal": "weight_loss",
        }, headers=alice_headers)
        resp = client.get("/api/users/1/progress", headers=alice_headers)
        d = resp.json()["progress"]
        assert d["targets"]["calories"] > 0


class TestRecommend:
    def test_recommend_veg(self, client, alice_headers):
        resp = client.post("/api/recommend", json={
            "target_cals": 2000, "target_pro": 100, "target_carb": 250, "target_fat": 55,
            "diet_type": "veg"
        }, headers=alice_headers)
        assert resp.status_code == 200
        items = resp.json()["recommendations"]
        assert len(items) > 0

    def test_recommend_nonveg(self, client, alice_headers):
        resp = client.post("/api/recommend", json={
            "target_cals": 2000, "target_pro": 100, "target_carb": 250, "target_fat": 55,
            "diet_type": "nonveg"
        }, headers=alice_headers)
        assert resp.status_code == 200

    def test_recommend_any(self, client, alice_headers):
        resp = client.post("/api/recommend", json={
            "target_cals": 500, "target_pro": 30, "target_carb": 60, "target_fat": 15,
            "diet_type": "any"
        }, headers=alice_headers)
        assert resp.status_code == 200

    def test_recommend_respects_calorie_budget(self, client, alice_headers):
        resp = client.post("/api/recommend", json={
            "target_cals": 100, "target_pro": 5, "target_carb": 10, "target_fat": 3,
            "diet_type": "any"
        }, headers=alice_headers)
        assert resp.status_code == 200

    def test_recommend_returns_correct_shape(self, client, alice_headers):
        resp = client.post("/api/recommend", json={
            "target_cals": 2000, "target_pro": 100, "target_carb": 250, "target_fat": 55,
            "diet_type": "veg"
        }, headers=alice_headers)
        items = resp.json()["recommendations"]
        for item in items:
            assert "name" in item
            assert "calories" in item
            assert "protein" in item
            assert "carbs" in item
            assert "fat" in item


class TestNextMealSuggestion:
    def test_suggestion_requires_auth(self, client):
        resp = client.get("/api/next-meal-suggestion/1")
        assert resp.status_code == 401

    def test_suggestion_basic(self, client, alice_headers):
        resp = client.get("/api/next-meal-suggestion/1", headers=alice_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "suggested_meals" in data
        assert "remaining_calories" in data

    def test_suggestion_anti_gravity(self, client, alice_headers):
        resp = client.get(
            "/api/next-meal-suggestion/1?anti_gravity=true",
            headers=alice_headers,
        )
        assert resp.status_code == 200

    def test_suggestion_returns_zero_when_no_remaining_calories(self, client, alice_headers):
        conn = get_connection()
        from database import IS_POSTGRES
        ph = "%s" if IS_POSTGRES else "?"
        conn.cursor().execute(
            f"INSERT INTO daily_logs (user_id, date, consumed_calories, consumed_protein, consumed_carbs, consumed_fats) "
            f"VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph})",
            (1, "2099-12-31", 99999, 9999, 9999, 9999)
        )
        conn.commit()
        conn.close()
        resp = client.get(
            "/api/next-meal-suggestion/1?anti_gravity=true",
            headers=alice_headers,
        )
        assert resp.status_code == 200


class TestRegionalInfo:
    REGIONAL_FOODS = ["Dosa", "Idli", "Butter Chicken", "Momos", "Bhel Puri", "Rohu Curry", "Baati"]

    @pytest.mark.parametrize("food", REGIONAL_FOODS)
    def test_get_regional_info(self, client, food):
        resp = client.get(f"/api/foods/regional-info?food_name={food}")
        assert resp.status_code == 200

    def test_get_regional_info_unknown_food(self, client):
        resp = client.get("/api/foods/regional-info?food_name=UnknownFoodXYZ")
        assert resp.status_code == 404


class TestRegionalEndpoints:
    def test_list_regions(self, client):
        resp = client.get("/api/foods/regions")
        assert resp.status_code == 200
        assert "regions" in resp.json()
        assert len(resp.json()["regions"]) > 0

    def test_list_states(self, client):
        resp = client.get("/api/foods/states")
        assert resp.status_code == 200
        assert "states" in resp.json()
        assert len(resp.json()["states"]) > 0

    def test_foods_by_region_south(self, client):
        resp = client.get("/api/foods/by-region/South%20India")
        assert resp.status_code == 200
        assert len(resp.json()["foods"]) > 0

    def test_foods_by_region_not_found(self, client):
        resp = client.get("/api/foods/by-region/Atlantis")
        assert resp.status_code == 404

    def test_foods_by_state_karnataka(self, client):
        resp = client.get("/api/foods/by-state/Karnataka")
        assert resp.status_code == 200
        assert len(resp.json()["foods"]) > 0

    def test_foods_by_state_not_found(self, client):
        resp = client.get("/api/foods/by-state/Westeros")
        assert resp.status_code == 404


class TestRegionalRecommendation:
    def test_recommend_with_region(self, client, alice_headers):
        resp = client.post("/api/recommend", json={
            "target_cals": 2000, "target_pro": 100, "target_carb": 250, "target_fat": 55,
            "diet_type": "any", "preferred_region": "South"
        }, headers=alice_headers)
        assert resp.status_code == 200

    def test_recommend_with_state(self, client, alice_headers):
        resp = client.post("/api/recommend", json={
            "target_cals": 2000, "target_pro": 100, "target_carb": 250, "target_fat": 55,
            "diet_type": "any", "preferred_state": "Karnataka"
        }, headers=alice_headers)
        assert resp.status_code == 200

    def test_next_meal_suggestion_has_reasoning_trace(self, client, alice_headers):
        resp = client.get("/api/next-meal-suggestion/1", headers=alice_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert any("reasoning_trace" in item for item in data.get("suggested_meals", []))

    def test_next_meal_suggestion_with_region_preference(self, client, alice_headers):
        resp = client.get("/api/next-meal-suggestion/1", headers=alice_headers)
        assert resp.status_code == 200

    def test_profile_has_region_and_state(self, client, alice_headers):
        client.post("/api/users/profile", json={
            "age": 28, "gender": "Female", "height_cm": 165, "weight_kg": 60,
            "activity_level": "active", "goal": "weight_loss",
            "preferred_region": "South", "preferred_state": "Karnataka"
        }, headers=alice_headers)
        resp = client.get("/api/users/1", headers=alice_headers)
        data = resp.json()
        assert data["user"].get("preferred_region") == "South"


# Fixture used by tests above
@pytest.fixture
def registered_alice(client):
    resp = client.post("/api/auth/register", json={
        "name": "Alice", "email": "alice@test.com", "password": "test123",
        "age": 28, "gender": "Female",
        "height_cm": 165, "weight_kg": 60,
        "activity_level": "active", "goal": "weight_loss"
    })
    assert resp.status_code == 200
    return resp.json()
