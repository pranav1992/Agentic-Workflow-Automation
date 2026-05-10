"""
Rate limiting implementation
"""
import time
from typing import Dict, Tuple, Optional
from functools import wraps
from fastapi import HTTPException, Request
from app.core.settings import get_settings


class RateLimiter:
    """Simple in-memory rate limiter"""
    
    def __init__(self):
        self.requests: Dict[str, list[float]] = {}
    
    def is_allowed(self, key: str, limit: int, window: int) -> bool:
        """
        Check if request is allowed based on rate limit
        
        Args:
            key: Identifier (IP, user ID, etc.)
            limit: Number of requests allowed
            window: Time window in seconds
        """
        now = time.time()
        
        if key not in self.requests:
            self.requests[key] = []
        
        # Remove old requests outside the window
        self.requests[key] = [
            req_time for req_time in self.requests[key]
            if now - req_time < window
        ]
        
        # Check if limit exceeded
        if len(self.requests[key]) >= limit:
            return False
        
        # Add current request
        self.requests[key].append(now)
        return True


# Global rate limiter instance
_rate_limiter = RateLimiter()


def rate_limit(limit: Optional[int] = None, window: Optional[int] = None):
    """
    Decorator for rate limiting endpoints
    
    Args:
        limit: Number of requests allowed (uses config if None)
        window: Time window in seconds (uses config if None)
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            settings = get_settings()
            
            if not settings.RATE_LIMIT_ENABLED:
                return await func(request, *args, **kwargs)
            
            # Get rate limit parameters
            req_limit = limit or settings.RATE_LIMIT_REQUESTS
            req_window = window or settings.RATE_LIMIT_PERIOD_SECONDS
            
            # Use IP address or user ID as key
            key = request.headers.get("X-Forwarded-For", request.client.host)
            
            if not _rate_limiter.is_allowed(key, req_limit, req_window):
                raise HTTPException(
                    status_code=429,
                    detail="Rate limit exceeded"
                )
            
            return await func(request, *args, **kwargs)
        
        return wrapper
    
    return decorator


def get_rate_limiter() -> RateLimiter:
    """Get the global rate limiter instance"""
    return _rate_limiter
