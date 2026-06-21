# Security Audit Report

**Generated:** 2026-06-19T13:46:42.709521Z

**Overall Security Score:** 10.0/10 (12/12 controls passed)

## Security Controls

| Control | Status | Detail |
|---------|--------|--------|
| HSTS Header | [PASS] Pass | Strict-Transport-Security with max-age=31536000 |
| CSP Header | [PASS] Pass | Content-Security-Policy restricts script/style sources |
| Permissions Policy | [PASS] Pass | Camera/mic/geolocation/payment disabled |
| X-Frame-Options | [PASS] Pass | DENY — clickjacking protection |
| Rate Limiting | [PASS] Pass | SlowAPI on login(10/m), register(10/m), analyze(30/m), recommend(60/m) |
| JWT Secret Validation | [PASS] Pass | Fails startup if <32 chars or default in production |
| Password Hashing | [PASS] Pass | bcrypt with per-password salt |
| Input Validation | [PASS] Pass | Pydantic schemas on all request bodies |
| SQL Injection Protection | [PASS] Pass | Parameterized queries via sqlite3 |
| Image Upload Validation | [PASS] Pass | Content-type check, size limit, decompression bomb protection |
| Cache Control | [PASS] Pass | no-store on /api/auth/ and /api/users/ paths |
| Auth on sensitive endpoints | [PASS] Pass | Soft auth on analyze, recommend, next-meal-suggestion |

## Recommendations

1. **HTTPS termination at nginx** — add TLS certificate to nginx config

2. **Short-lived tokens** — reduce JWT_EXPIRY_HOURS to 1 for sensitive operations

3. **Secrets rotation** — implement JWT secret rotation via environment variable
