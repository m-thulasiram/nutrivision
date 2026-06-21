"""Tests for Pydantic schema validators."""
import pytest
from schemas import MacroRequest, UserProfileCreate, RegisterRequest, LoginRequest


class TestMacroRequest:
    def test_valid(self):
        r = MacroRequest(target_cals=500, target_pro=25, target_carb=50, target_fat=15, diet_type="veg")
        assert r.diet_type == "veg"

    def test_diet_type_normalized(self):
        r = MacroRequest(target_cals=500, target_pro=25, target_carb=50, target_fat=15, diet_type="NonVeg")
        assert r.diet_type == "nonveg"

    def test_invalid_diet_type(self):
        with pytest.raises(ValueError):
            MacroRequest(target_cals=500, target_pro=25, target_carb=50, target_fat=15, diet_type="invalid")

    def test_negative_targets_fail(self):
        with pytest.raises(ValueError):
            MacroRequest(target_cals=-100, target_pro=25, target_carb=50, target_fat=15, diet_type="veg")

    def test_zero_targets_ok(self):
        r = MacroRequest(target_cals=0, target_pro=0, target_carb=0, target_fat=0, diet_type="any")
        assert r.target_cals == 0


class TestUserProfileCreate:
    def test_valid(self):
        r = UserProfileCreate(name="Alice", age=28, gender="Female", height_cm=165, weight_kg=60, activity_level="active", goal="weight_loss")
        assert r.gender == "female"
        assert r.activity_level == "active"

    def test_age_bounds(self):
        with pytest.raises(ValueError):
            UserProfileCreate(age=-1)
        with pytest.raises(ValueError):
            UserProfileCreate(age=200)

    def test_height_bounds(self):
        with pytest.raises(ValueError):
            UserProfileCreate(height_cm=0)
        with pytest.raises(ValueError):
            UserProfileCreate(height_cm=301)

    def test_weight_bounds(self):
        with pytest.raises(ValueError):
            UserProfileCreate(weight_kg=0)
        with pytest.raises(ValueError):
            UserProfileCreate(weight_kg=701)

    def test_invalid_gender(self):
        with pytest.raises(ValueError):
            UserProfileCreate(gender="alien")

    def test_invalid_activity(self):
        with pytest.raises(ValueError):
            UserProfileCreate(activity_level="super_active")

    def test_invalid_goal(self):
        with pytest.raises(ValueError):
            UserProfileCreate(goal="bulk")

    def test_defaults(self):
        r = UserProfileCreate()
        assert r.name == "Astronaut"
        assert r.age == 30
        assert r.gender in ("male", "Male")


class TestRegisterRequest:
    def test_valid(self):
        r = RegisterRequest(name="Alice", email="alice@example.com", password="secret123", age=28, gender="Female", height_cm=165, weight_kg=60, activity_level="active", goal="weight_loss")
        assert r.password == "secret123"
        assert r.name == "Alice"
        assert r.email == "alice@example.com"

    def test_short_password_fails(self):
        with pytest.raises(ValueError):
            RegisterRequest(name="Alice", email="alice@example.com", password="12345")

    def test_six_char_password_ok(self):
        r = RegisterRequest(name="Alice", email="alice@example.com", password="123456")
        assert r.password == "123456"

    def test_invalid_gender(self):
        with pytest.raises(ValueError):
            RegisterRequest(name="Alice", email="alice@example.com", password="secret123", gender="robot")


class TestLoginRequest:
    def test_valid(self):
        r = LoginRequest(email="alice@example.com", password="secret123")
        assert r.email == "alice@example.com"
        assert r.password == "secret123"
