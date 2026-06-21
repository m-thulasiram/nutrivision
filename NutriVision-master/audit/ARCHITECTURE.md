# NutriVision Architecture

ASCII diagram:

```
+------------------------------------------+
|           Frontend (React + TSX)          |
|   Vite + AuthContext + Components         |
+--------------------+---------------------+
|  Nginx Proxy       | /api/ -> backend    |
+--------------------+---------------------+
|              Backend (FastAPI)             |
|  auth | users | foods | analyze | rec     |
+------------------------------------------+
|  Middleware: CORS -> Security -> Obs      |
+------------------------------------------+
|  Services: auth, health, recommendation   |
+------------------------------------------+
|  Models: Autoencoder, YOLOv8, KNN        |
+------------------------------------------+
|  Database: SQLite + WAL + Migrations     |
+------------------------------------------+
|  Observability: Prometheus, Sentry, JSON  |
+------------------------------------------+
|  Docker: multi-stage, non-root, health    |
+------------------------------------------+
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| SQLite with WAL | Single-server deployment; zero operational overhead |
| JSON logging | Structured ingestion into log aggregators |
| ContextVars for IDs | Propagate correlation/user IDs without request plumbing |
| Soft auth | Backward-compatible: uses JWT if provided, falls back to defaults |
| Shared rate limiter | Single SlowAPI instance for consistent state |
| Multi-stage Docker | Minimize image size; non-root runtime |
