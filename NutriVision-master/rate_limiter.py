try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
    HAS_LIMITER = True
except Exception:
    limiter = None
    HAS_LIMITER = False


def rate_limit(limits: str):
    import os
    if os.environ.get("DISABLE_RATE_LIMIT") == "1":
        return lambda f: f
    if HAS_LIMITER and limiter is not None:
        return limiter.limit(limits)
    return lambda f: f
