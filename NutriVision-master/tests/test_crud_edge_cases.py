"""Edge case tests for CRUD operations not covered in test_crud.py."""
import pytest
import crud
from datetime import datetime, timedelta


# --- User Email Lookup ---
class TestUserEmailLookup:
    def test_get_user_by_email_found(self, db_conn, sample_user_data):
        crud.create_user(db_conn, sample_user_data)
        user = crud.get_user_by_email(db_conn, "testuser@test.com")
        assert user is not None
        assert user["name"] == "TestUser"

    def test_get_user_by_email_not_found(self, db_conn):
        assert crud.get_user_by_email(db_conn, "nonexistent@test.com") is None

    def test_get_user_by_email_empty_string(self, db_conn):
        assert crud.get_user_by_email(db_conn, "") is None


# --- Delete User ---
class TestDeleteUser:
    def test_delete_user_removes_user(self, db_conn, sample_user_data):
        user = crud.create_user(db_conn, sample_user_data)
        crud.delete_user(db_conn, user["id"])
        assert crud.get_user(db_conn, user["id"]) is None

    def test_delete_user_removes_meal_logs(self, db_conn, sample_user_data):
        user = crud.create_user(db_conn, sample_user_data)
        crud.create_meal_log(db_conn, {
            "user_id": user["id"],
            "detected_items": "Test Meal",
            "total_calories": 100.0,
            "total_protein": 10.0,
            "total_carbs": 10.0,
            "total_fats": 5.0,
        })
        crud.delete_user(db_conn, user["id"])
        cursor = db_conn.cursor()
        cursor.execute("SELECT COUNT(*) AS cnt FROM meal_logs WHERE user_id = ?", (user["id"],))
        assert cursor.fetchone()["cnt"] == 0

    def test_delete_user_removes_daily_logs(self, db_conn, sample_user_data):
        user = crud.create_user(db_conn, sample_user_data)
        crud.create_or_update_daily_log(db_conn, user["id"], "2099-01-01", 500.0, 25.0, 60.0, 15.0)
        crud.delete_user(db_conn, user["id"])
        cursor = db_conn.cursor()
        cursor.execute("SELECT COUNT(*) AS cnt FROM daily_logs WHERE user_id = ?", (user["id"],))
        assert cursor.fetchone()["cnt"] == 0

    def test_delete_nonexistent_user(self, db_conn):
        crud.delete_user(db_conn, 999)
        assert True


# --- Create User Edge Cases ---
class TestCreateUserEdgeCases:
    def test_create_user_empty_data(self, db_conn):
        with pytest.raises(ValueError, match="No valid user fields"):
            crud.create_user(db_conn, {})

    def test_create_user_only_invalid_fields(self, db_conn):
        with pytest.raises(ValueError, match="No valid user fields"):
            crud.create_user(db_conn, {"invalid_field": "value"})

    def test_create_user_minimal_data(self, db_conn):
        user = crud.create_user(db_conn, {"name": "Minimal", "email": "min@test.com"})
        assert user["name"] == "Minimal"
        assert user["id"] > 0


# --- Update User Edge Cases ---
class TestUpdateUserEdgeCases:
    def test_update_user_empty_data(self, db_conn, sample_user_data):
        user = crud.create_user(db_conn, sample_user_data)
        updated = crud.update_user(db_conn, user["id"], {})
        assert updated["name"] == "TestUser"

    def test_update_user_invalid_fields_ignored(self, db_conn, sample_user_data):
        user = crud.create_user(db_conn, sample_user_data)
        updated = crud.update_user(db_conn, user["id"], {"nonexistent_col": "value"})
        assert updated is not None
        assert updated["name"] == "TestUser"

    def test_update_user_not_found(self, db_conn):
        result = crud.update_user(db_conn, 999, {"name": "Ghost"})
        assert result is None


# --- Create Meal Log Edge Cases ---
class TestCreateMealLogEdgeCases:
    def test_create_meal_log_invalid_data(self, db_conn):
        with pytest.raises(ValueError, match="No valid meal log fields"):
            crud.create_meal_log(db_conn, {})

    def test_create_meal_log_no_valid_fields(self, db_conn):
        with pytest.raises(ValueError, match="No valid meal log fields"):
            crud.create_meal_log(db_conn, {"invalid": "data"})

    def test_create_meal_log_minimal(self, db_conn, sample_user_data):
        user = crud.create_user(db_conn, sample_user_data)
        crud.create_meal_log(db_conn, {"user_id": user["id"]})
        cursor = db_conn.cursor()
        cursor.execute("SELECT COUNT(*) AS cnt FROM meal_logs WHERE user_id = ?", (user["id"],))
        assert cursor.fetchone()["cnt"] == 1


# --- Meal Log Retrieval ---
class TestMealLogRetrieval:
    def test_get_meal_logs_for_user_empty(self, db_conn, sample_user_data):
        user = crud.create_user(db_conn, sample_user_data)
        logs = crud.get_meal_logs_for_user(db_conn, user["id"], "2099-01-01")
        assert logs == []

    def test_get_meal_logs_for_user_with_data(self, db_conn, sample_user_data):
        user = crud.create_user(db_conn, sample_user_data)
        crud.create_meal_log(db_conn, {
            "user_id": user["id"],
            "detected_items": "Lunch",
            "total_calories": 500.0,
            "total_protein": 25.0,
            "total_carbs": 60.0,
            "total_fats": 15.0,
        })
        today = crud.get_today_str()
        logs = crud.get_meal_logs_for_user(db_conn, user["id"], today)
        assert len(logs) == 1
        assert logs[0]["detected_items"] == "Lunch"

    def test_get_meal_logs_for_date_range(self, db_conn, sample_user_data):
        user = crud.create_user(db_conn, sample_user_data)
        crud.create_meal_log(db_conn, {
            "user_id": user["id"],
            "detected_items": "Breakfast",
            "total_calories": 300.0,
            "total_protein": 15.0,
            "total_carbs": 40.0,
            "total_fats": 10.0,
        })
        logs = crud.get_meal_logs_for_date_range(db_conn, user["id"], "2020-01-01", "2100-01-01")
        assert len(logs) >= 1

    def test_get_meal_logs_for_date_range_empty(self, db_conn):
        logs = crud.get_meal_logs_for_date_range(db_conn, 999, "2020-01-01", "2020-01-31")
        assert logs == []


# --- Daily Log Range ---
class TestDailyLogRange:
    def test_get_daily_logs_for_range(self, db_conn, sample_user_data):
        user = crud.create_user(db_conn, sample_user_data)
        crud.create_or_update_daily_log(db_conn, user["id"], "2099-01-01", 500.0, 25.0, 60.0, 15.0)
        logs = crud.get_daily_logs_for_range(db_conn, user["id"], "2099-01-01", "2099-01-31")
        assert len(logs) == 1

    def test_get_daily_logs_for_range_empty(self, db_conn):
        logs = crud.get_daily_logs_for_range(db_conn, 999, "2099-01-01", "2099-01-31")
        assert logs == []


# --- Daily Log Edge Cases ---
class TestDailyLogEdgeCases:
    def test_create_or_update_zero_values(self, db_conn, sample_user_data):
        user = crud.create_user(db_conn, sample_user_data)
        log = crud.create_or_update_daily_log(db_conn, user["id"], "2099-06-15", 0.0, 0.0, 0.0, 0.0)
        assert log["consumed_calories"] == 0.0
        assert log["consumed_protein"] == 0.0
        assert log["consumed_carbs"] == 0.0
        assert log["consumed_fats"] == 0.0

    def test_create_or_update_accumulates(self, db_conn, sample_user_data):
        user = crud.create_user(db_conn, sample_user_data)
        crud.create_or_update_daily_log(db_conn, user["id"], "2099-06-15", 100.0, 10.0, 20.0, 5.0)
        crud.create_or_update_daily_log(db_conn, user["id"], "2099-06-15", 200.0, 15.0, 30.0, 10.0)
        log = crud.get_daily_log(db_conn, user["id"], "2099-06-15")
        assert log["consumed_calories"] == 300.0
        assert log["consumed_protein"] == 25.0
        assert log["consumed_carbs"] == 50.0
        assert log["consumed_fats"] == 15.0

    def test_create_or_update_wrong_user(self, db_conn, sample_user_data):
        user = crud.create_user(db_conn, sample_user_data)
        with pytest.raises(Exception):
            crud.create_or_update_daily_log(db_conn, 999, "2099-06-15", 100.0, 10.0, 20.0, 5.0)
        actual = crud.get_daily_log(db_conn, user["id"], "2099-06-15")
        assert actual is None


# --- Password Reset Token CRUD ---
class TestPasswordResetTokens:
    def test_create_and_get_valid_token(self, db_conn, sample_user_data):
        user = crud.create_user(db_conn, sample_user_data)
        expires_at = (datetime.utcnow() + timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")
        crud.create_password_reset_token(db_conn, user["id"], "test-token-123", expires_at)
        record = crud.get_valid_reset_token(db_conn, "test-token-123")
        assert record is not None
        assert record["user_id"] == user["id"]
        assert record["used"] == 0

    def test_get_invalid_token(self, db_conn):
        assert crud.get_valid_reset_token(db_conn, "nonexistent-token") is None

    def test_mark_token_used(self, db_conn, sample_user_data):
        user = crud.create_user(db_conn, sample_user_data)
        expires_at = (datetime.utcnow() + timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")
        crud.create_password_reset_token(db_conn, user["id"], "token-to-use", expires_at)
        crud.mark_reset_token_used(db_conn, "token-to-use")
        record = crud.get_valid_reset_token(db_conn, "token-to-use")
        assert record is None

    def test_expired_token_not_valid(self, db_conn, sample_user_data):
        user = crud.create_user(db_conn, sample_user_data)
        expires_at = (datetime.utcnow() - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")
        crud.create_password_reset_token(db_conn, user["id"], "expired-token", expires_at)
        record = crud.get_valid_reset_token(db_conn, "expired-token")
        assert record is None

    def test_update_user_password(self, db_conn, sample_user_data):
        user = crud.create_user(db_conn, sample_user_data)
        crud.update_user_password(db_conn, user["id"], "new-hash-value")
        updated = crud.get_user(db_conn, user["id"])
        assert updated["password_hash"] == "new-hash-value"

    def test_clean_expired_reset_tokens(self, db_conn, sample_user_data):
        user = crud.create_user(db_conn, sample_user_data)
        fresh = (datetime.utcnow() + timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")
        expired = (datetime.utcnow() - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")
        crud.create_password_reset_token(db_conn, user["id"], "fresh-token", fresh)
        crud.create_password_reset_token(db_conn, user["id"], "expired-token", expired)
        crud.clean_expired_reset_tokens(db_conn)
        assert crud.get_valid_reset_token(db_conn, "fresh-token") is not None
        assert crud.get_valid_reset_token(db_conn, "expired-token") is None


# --- Utility Tests ---
class TestUtilityFunctions:
    def test_get_today_str_format(self):
        today = crud.get_today_str()
        parts = today.split("-")
        assert len(parts) == 3
        assert len(parts[0]) == 4
        assert len(parts[1]) == 2
        assert len(parts[2]) == 2
        datetime.strptime(today, "%Y-%m-%d")
