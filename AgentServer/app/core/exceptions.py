"""
Enhanced error handling and validation
"""
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from typing import Optional, Dict, Any
from app.core.logging import get_logger
from app.core.tenancy import TenantContext
from datetime import datetime

logger = get_logger(__name__)


class ApplicationError(Exception):
    """Base application error"""
    
    def __init__(
        self,
        message: str,
        status_code: int = 400,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code or "APPLICATION_ERROR"
        self.details = details or {}


class ValidationFailedError(ApplicationError):
    """Validation failed error"""
    def __init__(self, message: str, details: Optional[Dict] = None):
        super().__init__(
            message,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_code="VALIDATION_FAILED",
            details=details,
        )


class NotFoundError(ApplicationError):
    """Resource not found error"""
    def __init__(self, message: str, resource_type: Optional[str] = None):
        super().__init__(
            message,
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="NOT_FOUND",
            details={"resource_type": resource_type} if resource_type else {},
        )


class UnauthorizedError(ApplicationError):
    """Unauthorized access error"""
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(
            message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="UNAUTHORIZED",
        )


class ForbiddenError(ApplicationError):
    """Forbidden access error"""
    def __init__(self, message: str = "Access denied"):
        super().__init__(
            message,
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="FORBIDDEN",
        )


class TenantNotFoundError(ApplicationError):
    """Tenant not found error"""
    def __init__(self, tenant_id: str):
        super().__init__(
            f"Tenant {tenant_id} not found",
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="TENANT_NOT_FOUND",
        )


class TenantMismatchError(ApplicationError):
    """Tenant ID mismatch error"""
    def __init__(self):
        super().__init__(
            "Tenant ID mismatch",
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="TENANT_MISMATCH",
        )


def create_error_response(error: ApplicationError) -> Dict[str, Any]:
    """Create standardized error response"""
    return {
        "error": {
            "code": error.error_code,
            "message": error.message,
            "details": error.details,
            "request_id": TenantContext.get_request_id(),
            "timestamp": datetime.utcnow().isoformat(),
        }
    }


def setup_exception_handlers(app: FastAPI):
    """Setup global exception handlers"""
    
    @app.exception_handler(ApplicationError)
    async def application_error_handler(request: Request, exc: ApplicationError):
        logger.error(
            f"Application error: {exc.message}",
            error_code=exc.error_code,
            status_code=exc.status_code,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=create_error_response(exc),
        )
    
    @app.exception_handler(ValidationError)
    async def validation_error_handler(request: Request, exc: ValidationError):
        logger.warning(
            f"Validation error: {str(exc)}",
            errors=exc.errors(),
        )
        error = ValidationFailedError(
            "Validation failed",
            details={"errors": exc.errors()}
        )
        return JSONResponse(
            status_code=error.status_code,
            content=create_error_response(error),
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        logger.error(
            f"Unhandled exception: {str(exc)}",
            exception_type=type(exc).__name__,
        )
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred",
                    "request_id": TenantContext.get_request_id(),
                    "timestamp": datetime.utcnow().isoformat(),
                }
            },
        )
