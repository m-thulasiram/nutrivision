# NutriVision Deployment Guide

## Prerequisites

- Docker 24+ and Docker Compose v2+
- 4GB RAM minimum, 8GB recommended (for ML model loading)
- Linux/amd64 host (Windows via WSL2)

## Quick Start (Development)

```bash
cp .env.example .env
# Edit .env — set NUTRIVISION_JWT_SECRET to at least 32 random characters
docker compose up --build
# API: http://localhost:8000
# Frontend: http://localhost:80
# Health: http://localhost:8000/health
# Metrics: http://localhost:8000/metrics
```

## Production Deployment

### 1. Environment Configuration

```bash
export NUTRIVISION_ENV=production
export NUTRIVISION_JWT_SECRET=$(openssl rand -hex 32)
export NUTRIVISION_DB_URL=/data/nutrivision.db
export NUTRIVISION_CORS_ORIGINS=https://your-frontend-domain.com
export NUTRIVISION_SENTRY_DSN=https://your-dsn@sentry.io/123  # optional
```

### 2. Database

- SQLite with WAL mode. Persistent volume: `nutrivision_data`
- Backups: `sqlite3 /data/nutrivision.db ".backup /backups/$(date -u +%Y%m%d).db"`
- Migrations run automatically on startup via `migrations.py`

### 3. Docker Compose (Production)

```yaml
services:
  backend:
    image: nutrivision-backend:latest
    ports: ["8000:8000"]
    env_file: [.env.production]
    volumes: [nutrivision_data:/data]
    restart: unless-stopped
    security_opt: [no-new-privileges:true]
    read_only: true
    tmpfs: [/tmp]
    user: "1001:1001"
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:8000/health"]
      interval: 30s
      start_period: 30s
```

### 4. Health Checks

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | DB + model status; returns 200/503 |
| `GET /metrics` | Prometheus metrics |

### 5. Monitoring

- **Prometheus**: Scrape `/metrics` endpoint
- **Sentry**: Error tracking via `NUTRIVISION_SENTRY_DSN`
- **Logs**: JSON structured stdout; ingest with any log aggregator

## Database Backup & Restore

```bash
# Backup
docker exec nutrivision-backend-1 sqlite3 /data/nutrivision.db ".backup /data/backup-$(date -u +%Y%m%d).db"

# Restore
docker exec nutrivision-backend-1 sqlite3 /data/nutrivision.db ".restore /data/backup-20250101.db"
```

## Disaster Recovery

1. Stop containers: `docker compose down`
2. Restore DB from backup
3. Restart: `docker compose up -d`
4. Verify: `curl http://localhost:8000/health`

## CI/CD Pipeline

GitHub Actions workflow in `.github/workflows/ci.yml`:
1. `ruff check .` — linting
2. `pytest --cov=. --cov-fail-under=85` — tests + coverage
3. `docker build -f Dockerfile .` — backend image validation
4. `docker build -f Dockerfile.frontend .` — frontend image validation
