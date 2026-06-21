"""Tests for the /api/foods routes, especially the search endpoint."""
import pytest
from fastapi.testclient import TestClient
from api import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


class TestFoodSearch:
    def test_search_existing_food(self, client):
        resp = client.get("/api/foods/search?q=dosa")
        assert resp.status_code == 200
        data = resp.json()
        assert "foods" in data
        if data["foods"]:
            assert "food_items" in data["foods"][0]

    def test_search_no_results(self, client):
        resp = client.get("/api/foods/search?q=zzzznotafoodxxxx")
        assert resp.status_code == 200
        data = resp.json()
        assert data["foods"] == []

    def test_search_requires_query(self, client):
        resp = client.get("/api/foods/search")
        assert resp.status_code == 422

    def test_search_empty_query(self, client):
        resp = client.get("/api/foods/search?q=")
        assert resp.status_code == 422

    def test_search_case_insensitive(self, client):
        resp_lower = client.get("/api/foods/search?q=dosa")
        resp_upper = client.get("/api/foods/search?q=DOSA")
        assert resp_lower.status_code == 200
        assert resp_upper.status_code == 200

    def test_search_returns_correct_shape(self, client):
        resp = client.get("/api/foods/search?q=rice")
        assert resp.status_code == 200
        data = resp.json()
        for food in data["foods"]:
            assert "food_items" in food
            assert "Calories" in food
            assert "Proteins" in food
            assert "Carbohydrates" in food
            assert "Fats" in food
            assert "Veg_Flag" in food
            assert "region" in food
            assert "state" in food

    def test_search_partial_match(self, client):
        resp = client.get("/api/foods/search?q=chick")
        assert resp.status_code == 200
        data = resp.json()
        names = [f["food_items"].lower() for f in data["foods"]]
        assert any("chick" in n for n in names)

    def test_search_max_20_results(self, client):
        resp = client.get("/api/foods/search?q=a")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["foods"]) <= 20


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
