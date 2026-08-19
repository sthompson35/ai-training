import os
import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from .auth import decode_access_token

GENERAL_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
LOGIN_LIMIT_PER_MINUTE = int(os.getenv("LOGIN_RATE_LIMIT_PER_MINUTE", "5"))
WINDOW_SECONDS = 60

_hits: dict[str, deque] = defaultdict(deque)


def reset_rate_limits() -> None:
    _hits.clear()


def _allow(key: str, limit: int) -> bool:
    now = time.monotonic()
    window = _hits[key]
    while window and now - window[0] > WINDOW_SECONDS:
        window.popleft()
    if len(window) >= limit:
        return False
    window.append(now)
    return True


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return await call_next(request)

        client_host = request.client.host if request.client else "unknown"

        if request.url.path == "/v1/auth/login":
            key = f"login:{client_host}"
            limit = LOGIN_LIMIT_PER_MINUTE
        else:
            username = None
            auth_header = request.headers.get("authorization", "")
            if auth_header.startswith("Bearer "):
                try:
                    username = decode_access_token(auth_header.removeprefix("Bearer "))
                except Exception:
                    username = None
            key = f"user:{username}" if username else f"ip:{client_host}"
            limit = GENERAL_LIMIT_PER_MINUTE

        if not _allow(key, limit):
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Try again shortly."},
                headers={"Retry-After": str(WINDOW_SECONDS)},
            )

        return await call_next(request)
