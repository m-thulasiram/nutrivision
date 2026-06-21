from contextlib import contextmanager
from typing import Any, Iterator

from config import config
from logging_config import get_logger

logger = get_logger("nutrivision.database")


def _is_postgres(dsn: str) -> bool:
    return dsn.startswith("postgresql://") or dsn.startswith("postgres://")


def _is_sqlite(dsn: str) -> bool:
    return not _is_postgres(dsn)


IS_POSTGRES = _is_postgres(config.db_url)
IS_SQLITE = _is_sqlite(config.db_url)


if IS_POSTGRES:
    import psycopg2
    import psycopg2.extras
    import psycopg2.pool

    _pool = None

    def _get_pool():
        global _pool
        if _pool is None:
            _pool = psycopg2.pool.ThreadedConnectionPool(
                minconn=1,
                maxconn=10,
                dsn=config.db_url,
            )
        return _pool

    class _PostgresCursor:
        def __init__(self, pg_cursor):
            self._c = pg_cursor
            self._lastrowid: int | None = None

        def _adapt_sql(self, sql: str) -> str:
            sql = sql.replace("?", "%s")
            sql = sql.replace("datetime('now')", "NOW()")
            sql = sql.replace("date(timestamp)", "DATE(timestamp)")
            return sql

        def execute(self, sql: str, params: Any = None) -> "_PostgresCursor":
            adapted = self._adapt_sql(sql)
            needs_returning = (
                adapted.strip().upper().startswith("INSERT")
                and "RETURNING" not in adapted.upper()
            )
            if needs_returning:
                adapted += " RETURNING id"
            self._c.execute(adapted, params or ())
            if needs_returning:
                row = self._c.fetchone()
                self._lastrowid = row[0] if row else None
            return self

        def executemany(self, sql: str, seq: Any) -> None:
            adapted = self._adapt_sql(sql)
            self._c.executemany(adapted, seq)

        def fetchone(self) -> dict | None:
            row = self._c.fetchone()
            if row is None:
                return None
            return dict(row)

        def fetchall(self) -> list[dict]:
            return [dict(row) for row in self._c.fetchall()]

        @property
        def lastrowid(self) -> int | None:
            return self._lastrowid

        @property
        def description(self):
            return self._c.description

    class _PostgresConnection:
        def __init__(self, pg_conn):
            self._c = pg_conn

        def cursor(self) -> _PostgresCursor:
            pg_cursor = self._c.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            return _PostgresCursor(pg_cursor)

        def commit(self) -> None:
            self._c.commit()

        def rollback(self) -> None:
            self._c.rollback()

        def close(self) -> None:
            self._c.close()

    def get_db() -> Iterator[_PostgresConnection]:
        pool = _get_pool()
        conn = pool.getconn()
        conn.autocommit = False
        try:
            yield _PostgresConnection(conn)
        finally:
            pool.putconn(conn)

    def get_connection() -> _PostgresConnection:
        pool = _get_pool()
        conn = pool.getconn()
        conn.autocommit = False
        return _PostgresConnection(conn)

    def close_connection(conn: _PostgresConnection) -> None:
        pool = _get_pool()
        pool.putconn(conn._c)

    @contextmanager
    def transaction(conn: _PostgresConnection) -> Iterator[_PostgresConnection]:
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise

else:
    import sqlite3

    def _apply_pragmas(conn: sqlite3.Connection) -> None:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA busy_timeout=5000")
        conn.execute("PRAGMA synchronous=NORMAL")

    def get_db() -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(config.db_url, check_same_thread=False, timeout=5)
        conn.row_factory = sqlite3.Row
        _apply_pragmas(conn)
        try:
            yield conn
        finally:
            conn.close()

    def get_connection() -> sqlite3.Connection:
        conn = sqlite3.connect(config.db_url, timeout=5)
        conn.row_factory = sqlite3.Row
        _apply_pragmas(conn)
        return conn

    def close_connection(conn: sqlite3.Connection) -> None:
        conn.close()

    @contextmanager
    def transaction(conn: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise


def now_expr() -> str:
    return "NOW()" if IS_POSTGRES else "datetime('now')"


def date_col(col: str) -> str:
    return f"DATE({col})" if IS_POSTGRES else f"date({col})"


def placeholder() -> str:
    return "%s" if IS_POSTGRES else "?"


def insert_returning() -> str:
    return " RETURNING id" if IS_POSTGRES else ""


def init_db():
    if IS_POSTGRES:
        _init_pg()
    else:
        _init_sqlite()
    from migrations import run_migrations
    applied = run_migrations()
    if applied:
        logger.info("Migrations applied", extra={"migrations": applied})


def _init_sqlite():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL DEFAULT '',
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
            target_fats REAL DEFAULT 0.0,
            preferred_region TEXT DEFAULT '',
            preferred_state TEXT DEFAULT ''
        )
    """)
    cursor.execute("""
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
    """)
    cursor.execute("""
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
    """)
    conn.commit()
    conn.close()


def _init_pg():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL DEFAULT '',
            age INTEGER DEFAULT 30,
            gender TEXT DEFAULT 'Male',
            height_cm DOUBLE PRECISION DEFAULT 175.0,
            weight_kg DOUBLE PRECISION DEFAULT 70.0,
            activity_level TEXT DEFAULT 'moderate',
            goal TEXT DEFAULT 'maintain',
            bmr DOUBLE PRECISION DEFAULT 0.0,
            tdee DOUBLE PRECISION DEFAULT 0.0,
            target_calories DOUBLE PRECISION DEFAULT 0.0,
            target_protein DOUBLE PRECISION DEFAULT 0.0,
            target_carbs DOUBLE PRECISION DEFAULT 0.0,
            target_fats DOUBLE PRECISION DEFAULT 0.0,
            preferred_region TEXT DEFAULT '',
            preferred_state TEXT DEFAULT ''
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS meal_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            detected_items TEXT,
            total_calories DOUBLE PRECISION DEFAULT 0.0,
            total_protein DOUBLE PRECISION DEFAULT 0.0,
            total_carbs DOUBLE PRECISION DEFAULT 0.0,
            total_fats DOUBLE PRECISION DEFAULT 0.0,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            date TEXT,
            consumed_calories DOUBLE PRECISION DEFAULT 0.0,
            consumed_protein DOUBLE PRECISION DEFAULT 0.0,
            consumed_carbs DOUBLE PRECISION DEFAULT 0.0,
            consumed_fats DOUBLE PRECISION DEFAULT 0.0,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)
    conn.commit()
    conn.close()


def _add_column_if_not_exists(conn, cursor, table, column, col_def):
    if IS_POSTGRES:
        try:
            cursor.execute(
                "ALTER TABLE %s ADD COLUMN IF NOT EXISTS %s %s" % (table, column, col_def)
            )
        except Exception:
            pass
    else:
        cursor.execute("PRAGMA table_info(%s)" % table)
        cols = [r[1] for r in cursor.fetchall()]
        if column not in cols:
            cursor.execute("ALTER TABLE %s ADD COLUMN %s %s" % (table, column, col_def))


def _add_unique_constraint(conn, cursor, table, columns, constraint_name):
    col_list = ", ".join(columns)
    try:
        cursor.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS %s ON %s(%s)" % (constraint_name, table, col_list)
        )
    except Exception:
        pass


def _get_table_count() -> int:
    conn = get_connection()
    cur = conn.cursor()
    if IS_POSTGRES:
        cur.execute("SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema='public'")
    else:
        cur.execute("SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table'")
    row = cur.fetchone()
    conn.close()
    return row["cnt"] if row else 0


def verify_database() -> dict:
    issues = []
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) AS cnt FROM users")
        row = cur.fetchone()
        user_count = row["cnt"] if row else 0
        table_count = _get_table_count()
        conn.close()
    except Exception as e:
        return {"healthy": False, "issues": [str(e)], "user_count": 0, "table_count": 0}
    return {
        "healthy": len(issues) == 0,
        "issues": issues,
        "user_count": user_count,
        "table_count": table_count,
    }
