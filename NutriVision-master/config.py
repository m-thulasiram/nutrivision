import os
import sys
import secrets
from dataclasses import dataclass, field
from typing import List
from dotenv import load_dotenv

load_dotenv()


@dataclass
class Config:
    # Application
    env: str = "development"
    debug: bool = True

    # Security
    jwt_secret: str = ""
    jwt_expiration_hours: int = 24

    # Database
    db_url: str = "./nutrivision.db"

    # CORS
    cors_origins: List[str] = field(default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"])

    # Sentry
    sentry_dsn: str = ""

    # YOLO
    yolo_confidence: float = 0.60

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Release
    release: str = "nutrivision@1.0.0"


def _load_config() -> Config:
    errors: list[str] = []
    warnings: list[str] = []

    env = os.environ.get("NUTRIVISION_ENV", "development")
    is_prod = env.lower() in ("production", "prod")

    jwt_secret = os.environ.get("NUTRIVISION_JWT_SECRET", "")

    if not jwt_secret:
        if is_prod:
            errors.append("NUTRIVISION_JWT_SECRET is not set")
        else:
            jwt_secret = secrets.token_hex(32)
            warnings.append(f"NUTRIVISION_JWT_SECRET not set — generated ephemeral dev secret (changes on restart)")
    elif jwt_secret == "dev-secret-change-in-production":
        if is_prod:
            errors.append("NUTRIVISION_JWT_SECRET is set to the default insecure value 'dev-secret-change-in-production'")
        else:
            warnings.append("NUTRIVISION_JWT_SECRET is set to the default value (acceptable for development only)")
    elif len(jwt_secret) < 32 and not is_prod:
        warnings.append(f"NUTRIVISION_JWT_SECRET is only {len(jwt_secret)} chars (min 32 recommended)")

    db_url = os.environ.get("NUTRIVISION_DB_URL", "./nutrivision.db")
    if is_prod and not db_url.startswith("postgresql://") and not os.path.isabs(db_url):
        warnings.append(f"NUTRIVISION_DB_URL should be an absolute path or PostgreSQL DSN in production (got '{db_url}')")

    cors_raw = os.environ.get("NUTRIVISION_CORS_ORIGINS", "")
    if is_prod and cors_raw == "":
        errors.append("NUTRIVISION_CORS_ORIGINS must be set in production")
    cors_origins = cors_raw.split(",") if cors_raw else ["http://localhost:5173", "http://127.0.0.1:5173"]

    jwt_exp_hours_raw = os.environ.get("NUTRIVISION_JWT_EXPIRATION_HOURS", "24")
    try:
        jwt_exp_hours = int(jwt_exp_hours_raw)
        if jwt_exp_hours < 1:
            if is_prod:
                errors.append(f"NUTRIVISION_JWT_EXPIRATION_HOURS must be >= 1 (got {jwt_exp_hours})")
            else:
                jwt_exp_hours = 24
    except ValueError:
        if is_prod:
            errors.append(f"NUTRIVISION_JWT_EXPIRATION_HOURS must be an integer (got '{jwt_exp_hours_raw}')")
        else:
            jwt_exp_hours = 24

    sentry_dsn = os.environ.get("NUTRIVISION_SENTRY_DSN", "")

    yolo_conf_raw = os.environ.get("NUTRIVISION_YOLO_CONFIDENCE", "0.60")
    try:
        yolo_conf = float(yolo_conf_raw)
        if not (0.0 <= yolo_conf <= 1.0):
            errors.append(f"NUTRIVISION_YOLO_CONFIDENCE must be between 0.0 and 1.0 (got {yolo_conf})")
    except ValueError:
        errors.append(f"NUTRIVISION_YOLO_CONFIDENCE must be a float (got '{yolo_conf_raw}')")

    if errors:
        print("=" * 60, file=sys.stderr)
        print("FATAL: Configuration errors detected", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        for err in errors:
            print(f"  [ERROR] {err}", file=sys.stderr)
        print(file=sys.stderr)
        print("Startup aborted. Fix the above errors and restart.", file=sys.stderr)
        sys.exit(1)

    for warn in warnings:
        print(f"WARNING: {warn}", file=sys.stderr)

    return Config(
        env=env,
        debug=not is_prod,
        jwt_secret=jwt_secret,
        jwt_expiration_hours=jwt_exp_hours,
        db_url=db_url,
        cors_origins=cors_origins,
        sentry_dsn=sentry_dsn,
        yolo_confidence=yolo_conf,
    )


config = _load_config()
