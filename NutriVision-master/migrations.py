from database import get_connection, IS_POSTGRES
from logging_config import get_logger

logger = get_logger("nutrivision.migrations")

MIGRATIONS = [
    # v1: Initial schema — created by database.init_db()
    # v2: Add password_hash column
    {
        "version": 2,
        "description": "Add password_hash to users",
        "sql": [
            "ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''",
        ],
    },
    # v3: Add preferred_region and preferred_state
    {
        "version": 3,
        "description": "Add preferred_region, preferred_state to users",
        "sql": [
            "ALTER TABLE users ADD COLUMN preferred_region TEXT DEFAULT ''",
            "ALTER TABLE users ADD COLUMN preferred_state TEXT DEFAULT ''",
        ],
    },
    # v4: Add unique index on users.name
    {
        "version": 4,
        "description": "Add unique index on users.name",
        "sql": [
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_name ON users(name)",
        ],
    },
    # v5: Add unique index on daily_logs(user_id, date)
    {
        "version": 5,
        "description": "Add unique index on daily_logs(user_id, date)",
        "sql": [
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_logs_user_date ON daily_logs(user_id, date)",
        ],
    },
    # v6: Add meal_time column to meal_logs
    {
        "version": 6,
        "description": "Add meal_time to meal_logs",
        "sql": [
            "ALTER TABLE meal_logs ADD COLUMN meal_time TEXT DEFAULT 'meal'",
        ],
    },
    # v7: Add email column to users
    {
        "version": 7,
        "description": "Add email to users with unique index",
        "sql": [
            "ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''",
            "UPDATE users SET email = 'user_' || id || '@legacy.nutrivision' WHERE email = '' OR email IS NULL",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users(email)",
        ],
    },
    # v8: Add password reset tokens table
    {
        "version": 8,
        "description": "Add password_reset_tokens table",
        "sql": [
            "CREATE TABLE IF NOT EXISTS password_reset_tokens (%s)" % (
                "id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, token TEXT NOT NULL, "
                "expires_at TIMESTAMP NOT NULL, used INTEGER DEFAULT 0, "
                "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "
                "FOREIGN KEY (user_id) REFERENCES users(id)"
                if IS_POSTGRES else
                "id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT NOT NULL, "
                "expires_at TEXT NOT NULL, used INTEGER DEFAULT 0, "
                "created_at TEXT DEFAULT CURRENT_TIMESTAMP, "
                "FOREIGN KEY (user_id) REFERENCES users(id)"
            ),
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_reset_token ON password_reset_tokens(token)",
        ],
    },
    # v9: Add diet_type and email_verified to users
    {
        "version": 9,
        "description": "Add diet_type and email_verified to users",
        "sql": [
            "ALTER TABLE users ADD COLUMN diet_type TEXT DEFAULT 'any'",
            "ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0",
        ],
    },
]


def _ensure_migrations_table(conn) -> None:
    if IS_POSTGRES:
        conn.cursor().execute(
            "CREATE TABLE IF NOT EXISTS _migrations ("
            "version INTEGER PRIMARY KEY, "
            "applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "
            "description TEXT"
            ")"
        )
    else:
        conn.cursor().execute(
            "CREATE TABLE IF NOT EXISTS _migrations ("
            "version INTEGER PRIMARY KEY, "
            "applied_at DATETIME DEFAULT CURRENT_TIMESTAMP, "
            "description TEXT"
            ")"
        )


def get_applied_versions(conn) -> set[int]:
    try:
        rows = conn.cursor().execute("SELECT version FROM _migrations").fetchall()
        return {r["version"] for r in rows}
    except Exception:
        return set()


def run_migrations() -> list[str]:
    conn = get_connection()
    try:
        _ensure_migrations_table(conn)
        applied = get_applied_versions(conn)
        ran: list[str] = []

        for migration in sorted(MIGRATIONS, key=lambda m: m["version"]):
            if migration["version"] in applied:
                continue
            logger.info(
                "Running migration",
                extra={"version": migration["version"], "description": migration["description"]},
            )
            for stmt in migration["sql"]:
                try:
                    conn.cursor().execute(stmt)
                except Exception as e:
                    msg = str(e).lower()
                    if "duplicate column" in msg:
                        continue
                    if "column" in msg and "already exists" in msg:
                        continue
                    if "unique constraint" in msg and "index" in msg:
                        logger.warning("Unique index creation failed, skipping", extra={"error": str(e)})
                        continue
                    raise
            ph = "%s" if IS_POSTGRES else "?"
            conn.cursor().execute(
                f"INSERT INTO _migrations (version, description) VALUES ({ph}, {ph})",
                (migration["version"], migration["description"]),
            )
            conn.commit()
            ran.append(f"v{migration['version']}: {migration['description']}")

        return ran
    finally:
        conn.close()


def placeholder() -> str:
    return "%s" if IS_POSTGRES else "?"
