"""Automated database backup script.

Supports both SQLite (via sqlite3.backup) and PostgreSQL (via pg_dump).

Usage:
    python scripts/backup_db.py [--db-path ./nutrivision.db] [--backup-dir /backups]

Scheduled via cron:
    0 3 * * * cd /app && python scripts/backup_db.py >> /var/log/backup.log 2>&1
"""

import argparse
import os
import subprocess
import sys
from datetime import datetime, timezone


def _is_postgres(dsn: str) -> bool:
    return dsn.startswith("postgresql://") or dsn.startswith("postgres://")


def backup_sqlite(db_path: str, backup_dir: str) -> str:
    import sqlite3

    if not os.path.isfile(db_path):
        print(f"ERROR: Database not found at {db_path}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_name = f"nutrivision_backup_{timestamp}.db"
    backup_path = os.path.join(backup_dir, backup_name)

    conn = sqlite3.connect(db_path)
    backup_conn = sqlite3.connect(backup_path)
    try:
        conn.backup(backup_conn, pages=100)
        print(f"Backup created: {backup_path} ({os.path.getsize(backup_path)} bytes)")
    finally:
        backup_conn.close()
        conn.close()

    return backup_path


def backup_postgres(dsn: str, backup_dir: str) -> str:
    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_name = f"nutrivision_backup_{timestamp}.sql"
    backup_path = os.path.join(backup_dir, backup_name)

    result = subprocess.run(
        ["pg_dump", dsn, "--file", backup_path, "--format", "plain", "--no-owner"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"ERROR: pg_dump failed: {result.stderr}", file=sys.stderr)
        sys.exit(1)

    print(f"Backup created: {backup_path} ({os.path.getsize(backup_path)} bytes)")
    return backup_path


def cleanup_old_backups(backup_dir: str, max_backups: int, prefix: str) -> None:
    backups = sorted(
        [f for f in os.listdir(backup_dir) if f.startswith(prefix)],
        reverse=True,
    )
    while len(backups) > max_backups:
        old = backups.pop()
        os.remove(os.path.join(backup_dir, old))
        print(f"Removed old backup: {old}")


def main():
    parser = argparse.ArgumentParser(description="Backup NutriVision database")
    parser.add_argument("--db-path", default=os.environ.get("NUTRIVISION_DB_URL", "./nutrivision.db"))
    parser.add_argument("--backup-dir", default="/backups")
    parser.add_argument("--max-backups", type=int, default=30)
    args = parser.parse_args()

    if _is_postgres(args.db_path):
        path = backup_postgres(args.db_path, args.backup_dir)
        cleanup_old_backups(args.backup_dir, args.max_backups, "nutrivision_backup_")
    else:
        path = backup_sqlite(args.db_path, args.backup_dir)
        cleanup_old_backups(args.backup_dir, args.max_backups, "nutrivision_backup_")

    return path


if __name__ == "__main__":
    main()
