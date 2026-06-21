import pytest
from fastapi.testclient import TestClient
from api import app
from database import get_connection
import crud
from services.auth_service import hash_password, create_access_token
from services.hybrid_scanner_service import get_hybrid_candidates

@pytest.fixture
def test_client():
    with TestClient(app) as c:
        yield c

@pytest.fixture
def auth_headers():
    conn = get_connection()
    pw_hash = hash_password("secure123")
    user = crud.create_user(conn, {
        "name": "ScannerUser", "email": "scanner@test.com", "password_hash": pw_hash,
        "age": 28, "gender": "male",
        "height_cm": 175, "weight_kg": 75,
        "activity_level": "moderate", "goal": "maintain",
        "bmr": 1600.0, "tdee": 2400.0,
        "target_calories": 2400.0, "target_protein": 140.0,
        "target_carbs": 260.0, "target_fats": 75.0,
        "preferred_state": "Tamil Nadu", "diet_type": "non-vegetarian"
    })
    conn.commit()
    conn.close()
    token = create_access_token(user["id"], "ScannerUser")
    return {"Authorization": f"Bearer {token}"}

def test_service_candidate_matching():
    # Test state prioritization for Tamil Nadu and category Rice Dish (Appam class)
    res = get_hybrid_candidates("Appam", "Tamil Nadu", "vegetarian", hour=8)
    assert len(res) > 0
    # Top candidate should be Appam with Coconut Stew or Idli Sambar Tamilnadu
    assert any(c["state"] == "Tamil Nadu" for c in res)
    assert all(c["veg_nov_veg"] == 0 for c in res)

def test_match_endpoint(test_client, auth_headers):
    # Test calling /api/scanner/match route
    resp = test_client.post(
        "/api/scanner/match",
        json={"detected_class": "Chicken_Curry"},
        headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["detected_class"] == "Chicken_Curry"
    assert data["super_category"] == "Chicken Dish"
    assert len(data["candidates"]) > 0
    # Top candidate should be Chettinad Chicken or Andhra Chicken because of non-veg
    assert any("Chicken" in c["food_name"] or "Chettinad" in c["food_name"] for c in data["candidates"])
