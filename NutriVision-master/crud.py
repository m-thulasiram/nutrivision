import sqlite3
from datetime import datetime

# --- User CRUD ---

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

def create_user(conn, user_data: dict):
    cursor = conn.cursor()
    cols = ", ".join(user_data.keys())
    placeholders = ", ".join(["?"] * len(user_data))
    values = tuple(user_data.values())
    cursor.execute(f"INSERT INTO users ({cols}) VALUES ({placeholders})", values)
    conn.commit()
    return get_user(conn, cursor.lastrowid)

def update_user(conn, user_id: int, user_data: dict):
    cursor = conn.cursor()
    set_clause = ", ".join([f"{k} = ?" for k in user_data.keys()])
    values = tuple(user_data.values()) + (user_id,)
    cursor.execute(f"UPDATE users SET {set_clause} WHERE id = ?", values)
    conn.commit()
    return get_user(conn, user_id)

# --- MealLog CRUD ---

def create_meal_log(conn, meal_data: dict):
    cursor = conn.cursor()
    cols = ", ".join(meal_data.keys())
    placeholders = ", ".join(["?"] * len(meal_data))
    values = tuple(meal_data.values())
    cursor.execute(f"INSERT INTO meal_logs ({cols}) VALUES ({placeholders})", values)
    conn.commit()

# --- DailyLog CRUD ---

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
