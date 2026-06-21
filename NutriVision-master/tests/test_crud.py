import pytest
import crud
from datetime import datetime

# --- User CRUD ---
def test_get_all_users_empty(db_conn):
    users = crud.get_all_users(db_conn)
    assert users == []

def test_create_user(db_conn, sample_user_data):
    user = crud.create_user(db_conn, sample_user_data)
    assert user["id"] == 1
    assert user["name"] == "TestUser"
    assert user["age"] == 25
    assert user["tdee"] == pytest.approx(2628.41, rel=1e-2)

def test_get_user(db_conn, sample_user_data):
    crud.create_user(db_conn, sample_user_data)
    user = crud.get_user(db_conn, 1)
    assert user is not None
    assert user["name"] == "TestUser"

def test_get_user_not_found(db_conn):
    assert crud.get_user(db_conn, 999) is None

def test_get_user_by_name(db_conn, sample_user_data):
    crud.create_user(db_conn, sample_user_data)
    user = crud.get_user_by_name(db_conn, "TestUser")
    assert user is not None
    assert user["id"] == 1

def test_get_user_by_name_not_found(db_conn):
    assert crud.get_user_by_name(db_conn, "NoOne") is None

def test_get_all_users_with_data(db_conn, sample_user_data):
    user1_data = {**sample_user_data, "name": "Alice", "email": "alice@test.com"}
    user2_data = {**sample_user_data, "name": "Bob", "age": 30, "email": "bob@test.com"}
    crud.create_user(db_conn, user1_data)
    crud.create_user(db_conn, user2_data)
    users = crud.get_all_users(db_conn)
    assert len(users) == 2
    assert users[0]["name"] == "Alice"
    assert users[1]["name"] == "Bob"

def test_get_all_users_returns_correct_columns(db_conn, sample_user_data):
    crud.create_user(db_conn, sample_user_data)
    users = crud.get_all_users(db_conn)
    user = users[0]
    expected_keys = {"id", "name", "age", "gender", "height_cm", "weight_kg", "activity_level", "goal", "preferred_region", "preferred_state"}
    assert set(user.keys()) == expected_keys

def test_update_user(db_conn, sample_user_data):
    crud.create_user(db_conn, sample_user_data)
    updated = crud.update_user(db_conn, 1, {"age": 35, "goal": "muscle_gain"})
    assert updated["age"] == 35
    assert updated["goal"] == "muscle_gain"
    # Unchanged fields preserved
    assert updated["name"] == "TestUser"

def test_update_user_not_found(db_conn):
    result = crud.update_user(db_conn, 999, {"name": "Ghost"})
    assert result is None

# --- MealLog CRUD ---
def test_create_meal_log(db_conn, sample_user_data):
    user = crud.create_user(db_conn, sample_user_data)
    meal_data = {
        "user_id": user["id"],
        "detected_items": "Rice, Curry",
        "total_calories": 650.0,
        "total_protein": 25.0,
        "total_carbs": 80.0,
        "total_fats": 20.0
    }
    crud.create_meal_log(db_conn, meal_data)
    cursor = db_conn.cursor()
    cursor.execute("SELECT * FROM meal_logs WHERE id = 1")
    row = dict(cursor.fetchone())
    assert row["user_id"] == user["id"]
    assert row["detected_items"] == "Rice, Curry"
    assert row["total_calories"] == 650.0

# --- DailyLog CRUD ---
def test_create_daily_log(db_conn, sample_user_data):
    user = crud.create_user(db_conn, sample_user_data)
    today = crud.get_today_str()
    log = crud.create_or_update_daily_log(db_conn, user["id"], today, 500.0, 25.0, 60.0, 15.0)
    assert log["consumed_calories"] == 500.0
    assert log["consumed_protein"] == 25.0
    assert log["consumed_carbs"] == 60.0
    assert log["consumed_fats"] == 15.0

def test_update_daily_log(db_conn, sample_user_data):
    user = crud.create_user(db_conn, sample_user_data)
    today = crud.get_today_str()
    crud.create_or_update_daily_log(db_conn, user["id"], today, 500.0, 25.0, 60.0, 15.0)
    # Add another meal
    log = crud.create_or_update_daily_log(db_conn, user["id"], today, 300.0, 20.0, 30.0, 10.0)
    assert log["consumed_calories"] == 800.0
    assert log["consumed_protein"] == 45.0
    assert log["consumed_carbs"] == 90.0
    assert log["consumed_fats"] == 25.0

def test_get_daily_log_exists(db_conn, sample_user_data):
    user = crud.create_user(db_conn, sample_user_data)
    today = crud.get_today_str()
    crud.create_or_update_daily_log(db_conn, user["id"], today, 500.0, 25.0, 60.0, 15.0)
    log = crud.get_daily_log(db_conn, user["id"], today)
    assert log is not None
    assert log["consumed_calories"] == 500.0

def test_get_daily_log_not_found(db_conn):
    log = crud.get_daily_log(db_conn, 999, "2099-01-01")
    assert log is None

def test_get_daily_log_wrong_date(db_conn, sample_user_data):
    user = crud.create_user(db_conn, sample_user_data)
    today = crud.get_today_str()
    crud.create_or_update_daily_log(db_conn, user["id"], today, 500.0, 25.0, 60.0, 15.0)
    log = crud.get_daily_log(db_conn, user["id"], "2020-01-01")
    assert log is None

# --- Utility ---
def test_get_today_str_format():
    today = crud.get_today_str()
    # Should be YYYY-MM-DD format
    parts = today.split("-")
    assert len(parts) == 3
    assert len(parts[0]) == 4
    assert len(parts[1]) == 2
    assert len(parts[2]) == 2
    # Should be parseable as date
    datetime.strptime(today, "%Y-%m-%d")
