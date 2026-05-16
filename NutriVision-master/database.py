import sqlite3

DATABASE_URL = "./nutrivision.db"

def get_db():
    conn = sqlite3.connect(DATABASE_URL, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    conn = sqlite3.connect(DATABASE_URL)
    cursor = conn.cursor()
    # Create tables
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT DEFAULT 'Astronaut',
            age INTEGER DEFAULT 30,
            gender TEXT DEFAULT 'Male',
            height_cm REAL DEFAULT 175.0,
            weight_kg REAL DEFAULT 70.0,
            activity_level TEXT DEFAULT 'moderate',
            goal TEXT DEFAULT 'maintain',
            bmr REAL DEFAULT 0.0,
            tdee REAL DEFAULT 0.0,
            target_calories REAL DEFAULT 0.0,
            target_protein REAL DEFAULT 0.0,
            target_carbs REAL DEFAULT 0.0,
            target_fats REAL DEFAULT 0.0
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS meal_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            detected_items TEXT,
            total_calories REAL DEFAULT 0.0,
            total_protein REAL DEFAULT 0.0,
            total_carbs REAL DEFAULT 0.0,
            total_fats REAL DEFAULT 0.0,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS daily_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            date TEXT,
            consumed_calories REAL DEFAULT 0.0,
            consumed_protein REAL DEFAULT 0.0,
            consumed_carbs REAL DEFAULT 0.0,
            consumed_fats REAL DEFAULT 0.0,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    conn.commit()
    conn.close()
