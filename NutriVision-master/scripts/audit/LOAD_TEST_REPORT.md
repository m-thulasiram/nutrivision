# Load Test Report

**Generated:** 2026-06-24T05:55:14.319454Z

## Scenarios

| Endpoint | Weight | Target P95 | Target Error Rate |
|----------|--------|------------|-------------------|
| GET /health | 1 | <300ms | <0.1% |
| GET /api/auth/me | 3 | <200ms | <0.1% |
| POST /api/recommend | 5 | <500ms | <1% |
| GET /api/foods/regions | 2 | <200ms | <0.1% |
| GET /api/foods/states | 2 | <200ms | <0.1% |
| GET /metrics | 1 | <200ms | <0.1% |

## How to Run

```bash
# 100 users, 10 spawn rate
locust -f locustfile.py --host http://localhost:8000 --users 100 --spawn-rate 10 --run-time 5m --headless --csv=audit/load_test_100

# 500 users
locust -f locustfile.py --host http://localhost:8000 --users 500 --spawn-rate 25 --run-time 5m --headless --csv=audit/load_test_500

# 1000 users
locust -f locustfile.py --host http://localhost:8000 --users 1000 --spawn-rate 50 --run-time 5m --headless --csv=audit/load_test_1000
```

## Target Metrics

- P95 response time < 500ms
- Error rate < 1%
- Requests/sec > 50 at 100 users