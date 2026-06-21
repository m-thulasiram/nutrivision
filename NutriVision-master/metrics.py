from prometheus_client import Counter, Histogram, Gauge, generate_latest, REGISTRY
from fastapi import Response

request_count = Counter(
    "nutrivision_http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"]
)

request_latency = Histogram(
    "nutrivision_http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "endpoint"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)
)

recommendation_latency = Histogram(
    "nutrivision_recommendation_duration_seconds",
    "Recommendation endpoint latency",
    ["engine"],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0)
)

yolo_inference_latency = Histogram(
    "nutrivision_yolo_inference_duration_seconds",
    "YOLO inference latency",
    buckets=(0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 10.0)
)

auth_success_total = Counter(
    "nutrivision_auth_success_total",
    "Successful authentications"
)

auth_failure_total = Counter(
    "nutrivision_auth_failure_total",
    "Failed authentications"
)

active_requests = Gauge(
    "nutrivision_active_requests",
    "Currently active requests"
)


def metrics(request: Response) -> Response:
    return Response(
        content=generate_latest(REGISTRY).decode("utf-8"),
        media_type="text/plain; charset=utf-8"
    )
