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

logger = get_logger(__name__)


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
    """Middleware to enforce tenant isolation"""
    
    async def dispatch(self, request: Request, call_next):
        # Extract tenant ID from header or path
        tenant_id = request.headers.get("X-Tenant-ID")
        
        if tenant_id and tenant_id != "":
            TenantContext.set_tenant_id(tenant_id)
        
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
