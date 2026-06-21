from datetime import datetime

ALLOWED_USER_COLS = {
    "name", "email", "password_hash", "age", "gender", "height_cm", "weight_kg",
    "activity_level", "goal", "bmr", "tdee",
    "target_calories", "target_protein", "target_carbs", "target_fats",
    "preferred_region", "preferred_state", "diet_type"
}

def _filter_user_data(data: dict) -> dict:
    return {k: v for k, v in data.items() if k in ALLOWED_USER_COLS}

def get_user(conn, user_id: int):
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    return dict(row) if row else None

def get_user_by_name(conn, name: str):
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE name = ?", (name,))
    row = cursor.fetchone()
    return dict(row) if row else None

def get_user_by_email(conn, email: str):
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    row = cursor.fetchone()
    return dict(row) if row else None

def get_all_users(conn, page: int = 1, per_page: int = 50):
    cursor = conn.cursor()
    offset = (page - 1) * per_page
    cursor.execute(
        "SELECT id, name, age, gender, height_cm, weight_kg, activity_level, goal, preferred_region, preferred_state FROM users ORDER BY id LIMIT ? OFFSET ?",
        (per_page, offset)
    )
    return [dict(row) for row in cursor.fetchall()]

def create_user(conn, user_data: dict):
    safe = _filter_user_data(user_data)
    if not safe:
        raise ValueError("No valid user fields provided")
    cols = ", ".join(safe.keys())
    placeholders = ", ".join(["?"] * len(safe))
    values = tuple(safe.values())
    cursor = conn.cursor()
    cursor.execute(f"INSERT INTO users ({cols}) VALUES ({placeholders})", values)
    conn.commit()
    return get_user(conn, cursor.lastrowid)

def update_user(conn, user_id: int, user_data: dict):
    safe = _filter_user_data(user_data)
    if not safe:
        return get_user(conn, user_id)
    set_clause = ", ".join([f"{k} = ?" for k in safe.keys()])
    values = tuple(safe.values()) + (user_id,)
    cursor = conn.cursor()
    cursor.execute(f"UPDATE users SET {set_clause} WHERE id = ?", values)
    conn.commit()
    return get_user(conn, user_id)

def delete_user(conn, user_id: int):
    cursor = conn.cursor()
    cursor.execute("DELETE FROM meal_logs WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM daily_logs WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()

def create_meal_log(conn, meal_data: dict):
    safe = {k: v for k, v in meal_data.items() if k in {"user_id", "meal_time", "detected_items", "total_calories", "total_protein", "total_carbs", "total_fats"}}
    if not safe:
        raise ValueError("No valid meal log fields provided")
    cursor = conn.cursor()
    cols = ", ".join(safe.keys())
    placeholders = ", ".join(["?"] * len(safe))
    values = tuple(safe.values())
    cursor.execute(f"INSERT INTO meal_logs ({cols}) VALUES ({placeholders})", values)
    conn.commit()

def get_daily_log(conn, user_id: int, date: str):
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM daily_logs WHERE user_id = ? AND date = ?", (user_id, date))
    row = cursor.fetchone()
    return dict(row) if row else None

def create_or_update_daily_log(conn, user_id: int, date: str, added_cals: float, added_pro: float, added_carbs: float, added_fats: float):
    daily_log = get_daily_log(conn, user_id, date)
    cursor = conn.cursor()
    if not daily_log:
        cursor.execute('''
            INSERT INTO daily_logs (user_id, date, consumed_calories, consumed_protein, consumed_carbs, consumed_fats)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, date, added_cals, added_pro, added_carbs, added_fats))
    else:
        cursor.execute('''
            UPDATE daily_logs SET
            consumed_calories = consumed_calories + ?,
            consumed_protein = consumed_protein + ?,
            consumed_carbs = consumed_carbs + ?,
            consumed_fats = consumed_fats + ?
            WHERE user_id = ? AND date = ?
        ''', (added_cals, added_pro, added_carbs, added_fats, user_id, date))
    conn.commit()
    return get_daily_log(conn, user_id, date)

def get_today_str():
    return datetime.utcnow().strftime("%Y-%m-%d")

def get_meal_logs_for_user(conn, user_id: int, date: str):
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, timestamp, meal_time, detected_items, total_calories, total_protein, total_carbs, total_fats "
        "FROM meal_logs WHERE user_id = ? AND date(timestamp) = ? ORDER BY timestamp ASC",
        (user_id, date)
    )
    return [dict(row) for row in cursor.fetchall()]

def get_meal_logs_for_date_range(conn, user_id: int, start_date: str, end_date: str):
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, timestamp, meal_time, detected_items, total_calories, total_protein, total_carbs, total_fats "
        "FROM meal_logs WHERE user_id = ? AND date(timestamp) BETWEEN ? AND ? ORDER BY timestamp ASC",
        (user_id, start_date, end_date)
    )
    return [dict(row) for row in cursor.fetchall()]

def get_daily_logs_for_range(conn, user_id: int, start_date: str, end_date: str):
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM daily_logs WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date ASC",
        (user_id, start_date, end_date)
    )
    return [dict(row) for row in cursor.fetchall()]


def create_password_reset_token(conn, user_id: int, token: str, expires_at: str):
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
        (user_id, token, expires_at),
    )
    conn.commit()


def get_valid_reset_token(conn, token: str):
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > datetime('now')",
        (token,),
    )
    row = cursor.fetchone()
    return dict(row) if row else None


def mark_reset_token_used(conn, token: str):
    cursor = conn.cursor()
    cursor.execute("UPDATE password_reset_tokens SET used = 1 WHERE token = ?", (token,))
    conn.commit()


def update_user_password(conn, user_id: int, password_hash: str):
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (password_hash, user_id))
    conn.commit()


def clean_expired_reset_tokens(conn):
    cursor = conn.cursor()
    cursor.execute("DELETE FROM password_reset_tokens WHERE expires_at <= datetime('now')")
    conn.commit()
