import os
# Force multi-threaded BLAS/OpenMP libraries to use a single thread to minimize RAM
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

# Disable Ultralytics YOLO telemetry/analytics and force offline mode to prevent network socket blocks
os.environ["ULTRALYTICS_ANALYTICS"] = "false"
os.environ["ULTRALYTICS_OFFLINE"] = "true"

try:
    import onnxruntime as ort
    original_InferenceSession = ort.InferenceSession

    def wrapped_InferenceSession(path_or_bytes, sess_options=None, providers=None, *args, **kwargs):
        if sess_options is None:
            sess_options = ort.SessionOptions()
        sess_options.intra_op_num_threads = 1
        sess_options.inter_op_num_threads = 1
        sess_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        
        # Force CPU-only provider to prevent CUDA/GPU driver loading hangs on Render
        forced_providers = ['CPUExecutionProvider']
        kwargs.pop('providers', None)
        
        return original_InferenceSession(path_or_bytes, sess_options, forced_providers, *args, **kwargs)

    ort.InferenceSession = wrapped_InferenceSession
except ImportError:
    pass

from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Response

from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from config import config
from database import init_db
from logging_config import setup_logging, get_logger

# Setup structured logging (must be first)
setup_logging()
logger = get_logger("nutrivision.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    from models import load_models
    load_models()
    logger.info("Models loaded successfully")
    yield
    logger.info("Shutting down")


app = FastAPI(title="NutriVision Neuro-Symbolic API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Observability & Security middleware (order matters: security headers outermost)
from middleware import HTTPSRedirectMiddleware, ObservabilityMiddleware, SecurityHeadersMiddleware
app.add_middleware(HTTPSRedirectMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(ObservabilityMiddleware)

# Sentry integration
if config.sentry_dsn:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        sentry_sdk.init(
            dsn=config.sentry_dsn,
            integrations=[FastApiIntegration()],
            traces_sample_rate=0.1,
            environment=config.env,
            release=config.release,
        )
        logger.info("Sentry initialized", extra={"dsn": config.sentry_dsn[:20] + "..."})
    except Exception as e:
        logger.error(f"Sentry init failed: {e}")

# Rate limiting
from rate_limiter import limiter, HAS_LIMITER as _HAS_LIMITER
if _HAS_LIMITER and limiter is not None:
    from slowapi import _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    logger.info("Rate limiter initialized")
else:
    logger.warning("Rate limiter not available (slowapi not installed)")

# Initialize DB
init_db()

# Include metrics endpoint (no rate limit)
from metrics import metrics as metrics_handler
app.add_api_route("/metrics", metrics_handler, include_in_schema=False)

# Health endpoint
@app.get("/health")
@app.get("/api/health")
def health():
    try:
        from database import get_connection, close_connection
        conn = get_connection()
        try:
            conn.execute("SELECT 1")
            db_ok = True
        finally:
            close_connection(conn)
    except Exception:
        db_ok = False
    try:
        from models import get_models
        m = get_models()
        models_ok = m.autoencoder is not None and m.yolo_model is not None
    except Exception:
        models_ok = False
    status_value = "ok" if (db_ok and models_ok) else "degraded"
    db_status = "ok" if db_ok else "error"
    model_status = "ok" if models_ok else "error"
    status_code = 200 if (db_ok and models_ok) else 503
    return Response(
        content=f'{{"status":"{status_value}","database":"{db_status}","models":"{model_status}"}}',
        media_type="application/json",
        status_code=status_code
    )



# Include route modules
from routes.auth import router as auth_router
from routes.users import router as users_router
from routes.foods import router as foods_router
from routes.analyze import router as analyze_router
from routes.recommend import router as recommend_router
from routes.workouts import router as workouts_router
from routes.copilot import router as copilot_router
from routes.scanner import router as scanner_router

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(foods_router)
app.include_router(analyze_router)
app.include_router(recommend_router)
app.include_router(workouts_router)
app.include_router(copilot_router)
app.include_router(scanner_router)

# Serve frontend SPA (must be last to not shadow API routes)
FRONTEND_DIR = Path(__file__).parent / "frontend" / "dist"
if FRONTEND_DIR.exists():
    from fastapi.responses import FileResponse

    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = FRONTEND_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    logger.info("Frontend SPA mounted", extra={"path": str(FRONTEND_DIR)})
else:
    logger.warning("Frontend dist not found, API-only mode", extra={"path": str(FRONTEND_DIR)})

logger.info("NutriVision API initialized", extra={"env": config.env, "debug": config.debug})
