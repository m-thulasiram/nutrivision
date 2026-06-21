import time
import uuid
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from logging_config import correlation_id, request_id, authenticated_user_id, get_logger
from metrics import request_count, request_latency, active_requests

logger = get_logger("nutrivision.middleware")


class ObservabilityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        cid = request.headers.get("X-Correlation-ID", uuid.uuid4().hex[:16])
        rid = uuid.uuid4().hex[:12]
        correlation_id.set(cid)
        request_id.set(rid)
        authenticated_user_id.set(0)

        auth_header = request.headers.get("Authorization", "")
        if auth_header.lower().startswith("bearer "):
            try:
                from services.auth_service import decode_access_token
                token = auth_header[7:]
                payload = decode_access_token(token)
                if payload:
                    authenticated_user_id.set(payload.get("user_id", 0))
            except Exception:
                pass

        active_requests.inc()
        start = time.monotonic()
        try:
            response = await call_next(request)
        except Exception:
            active_requests.dec()
            duration = time.monotonic() - start
            endpoint = request.url.path
            method = request.method
            request_count.labels(method=method, endpoint=endpoint, status=500).inc()
            request_latency.labels(method=method, endpoint=endpoint).observe(duration)
            raise
        else:
            active_requests.dec()
            duration = time.monotonic() - start
            endpoint = request.url.path
            method = request.method
            status_code = getattr(response, "status_code", 500)
            request_count.labels(method=method, endpoint=endpoint, status=status_code).inc()
            request_latency.labels(method=method, endpoint=endpoint).observe(duration)
            response.headers["X-Request-ID"] = rid
            response.headers["X-Correlation-ID"] = cid
            return response


class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
    """Redirect HTTP to HTTPS when X-Forwarded-Proto is http (behind nginx/reverse proxy)."""
    async def dispatch(self, request: Request, call_next):
        if request.url.path in ("/health", "/metrics"):
            return await call_next(request)
        forwarded_proto = request.headers.get("X-Forwarded-Proto", "")
        if forwarded_proto.lower() == "http":
            url = request.url.replace(scheme="https")
            return Response(status_code=301, headers={"Location": str(url)})
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "connect-src 'self' https://*.sentry.io; "
            "font-src 'self'"
        )
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), interest-cohort=(), "
            "payment=(), usb=(), magnetometer=(), accelerometer=()"
        )
        auth_paths = ("/api/auth/", "/api/users/")
        if request.url.path.startswith(auth_paths):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response
