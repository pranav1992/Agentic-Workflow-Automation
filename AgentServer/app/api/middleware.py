"""
Custom middleware for cross-cutting concerns
"""
import uuid
import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from app.core.tenancy import TenantContext
from app.core.logging import get_logger
from app.core.rate_limiter import get_rate_limiter
from app.core.security import get_jwt_manager
from app.core.settings import get_settings

logger = get_logger(__name__)


def _client_ip(request: Request) -> str:
    # uvicorn runs with --proxy-headers --forwarded-allow-ips=* behind
    # Caddy (see Dockerfile), so Starlette's ProxyHeadersMiddleware has
    # already parsed X-Forwarded-For and resolved request.client.host to
    # the real caller. Re-parsing the raw header here instead would be
    # wrong *and* attacker-controlled: anyone can send their own
    # `X-Forwarded-For: 1.2.3.4` and have it taken at face value, which
    # defeats IP-based limiting (most importantly on /auth/login) entirely.
    return request.client.host if request.client else "unknown"


def _decode_bearer_token(authorization: str | None) -> dict | None:
    """Best-effort JWT payload decode. Never raises — an invalid/expired
    token here just falls back to IP-based limiting or no tenant context;
    the real auth check happens in the route dependencies
    (app/api/dependencies/auth.py:get_current_user).
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    return get_jwt_manager().decode_token(token)


def _bearer_subject(request: Request) -> str | None:
    """JWT `sub` claim, so rate limits key on the actual user rather than
    a shared IP once someone's signed in."""
    payload = _decode_bearer_token(request.headers.get("Authorization"))
    return payload.get("sub") if payload else None


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Global per-caller request cap, on top of any endpoint-specific limits
    (e.g. the voice-demo launch's concurrency/spend caps in SessionService).

    Keys on the signed-in user's id when a valid bearer token is present,
    otherwise falls back to client IP — covers unauthenticated requests
    (login attempts, bad tokens) the same as everything else.
    """

    EXEMPT_PREFIXES = ("/health",)

    async def dispatch(self, request: Request, call_next):
        settings = get_settings()
        if not settings.RATE_LIMIT_ENABLED or request.url.path.startswith(
            self.EXEMPT_PREFIXES
        ):
            return await call_next(request)

        key = _bearer_subject(request) or f"ip:{_client_ip(request)}"
        limiter = get_rate_limiter()
        if not limiter.is_allowed(
            f"global:{key}",
            settings.RATE_LIMIT_REQUESTS,
            settings.RATE_LIMIT_PERIOD_SECONDS,
        ):
            return Response(
                content='{"detail":"Too many requests. Please slow down."}',
                status_code=429,
                media_type="application/json",
            )

        return await call_next(request)


class LoginRateLimitMiddleware(BaseHTTPMiddleware):
    """Tighter, IP-keyed cap on /auth/login and /auth/register.

    Both are unauthenticated by definition, so the global per-user limiter
    above can't key on identity here — without a separate, stricter cap a
    script could brute-force passwords (or spam-create tenants) at the
    general request rate.
    """

    PATHS = ("/auth/login", "/auth/register")

    async def dispatch(self, request: Request, call_next):
        settings = get_settings()
        if not settings.RATE_LIMIT_ENABLED or request.url.path not in self.PATHS:
            return await call_next(request)

        limiter = get_rate_limiter()
        if not limiter.is_allowed(
            f"login:{_client_ip(request)}",
            settings.LOGIN_RATE_LIMIT_ATTEMPTS,
            settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
        ):
            return Response(
                content='{"detail":"Too many login attempts. Please try again later."}',
                status_code=429,
                media_type="application/json",
            )

        return await call_next(request)


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Middleware to add request ID to all requests"""
    
    async def dispatch(self, request: Request, call_next):
        # Generate or get request ID
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        TenantContext.set_request_id(request_id)
        
        # Add to response headers
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        
        return response


class TenantIsolationMiddleware(BaseHTTPMiddleware):
    """Populates TenantContext from the caller's verified JWT.

    This used to trust a client-supplied `X-Tenant-ID` header — anyone
    could set that to any value and have requests treated as belonging to
    a different tenant. The tenant a request acts as must come from the
    signed token, never from something the client can set directly.
    """

    async def dispatch(self, request: Request, call_next):
        payload = _decode_bearer_token(request.headers.get("Authorization"))
        raw_tenant_id = payload.get("tenant_id") if payload else None

        if raw_tenant_id:
            try:
                TenantContext.set_tenant_id(uuid.UUID(raw_tenant_id))
            except ValueError:
                pass

        response = await call_next(request)
        return response


class RequestTimingMiddleware(BaseHTTPMiddleware):
    """Middleware to track request processing time"""
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        response = await call_next(request)
        
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        
        # Log request details
        logger.info(
            f"{request.method} {request.url.path}",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            process_time=process_time,
        )
        
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to add security headers"""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        
        return response


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Middleware for centralized error handling"""
    
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            return response
        except Exception as exc:
            logger.error(
                f"Unhandled exception: {str(exc)}",
                exception_type=type(exc).__name__,
                error_message=str(exc),
            )
            
            # Return error response
            return Response(
                content='{"detail": "Internal server error"}',
                status_code=500,
                media_type="application/json",
            )
