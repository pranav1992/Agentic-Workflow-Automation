"""
Multi-tenancy context management
"""
from typing import Optional
from contextvars import ContextVar
from uuid import UUID

# Context variables for tenant isolation
_tenant_id_ctx: ContextVar[Optional[UUID]] = ContextVar('tenant_id', default=None)
_user_id_ctx: ContextVar[Optional[UUID]] = ContextVar('user_id', default=None)
_request_id_ctx: ContextVar[Optional[str]] = ContextVar('request_id', default=None)


class TenantContext:
    """Manages tenant context for the current request"""
    
    @staticmethod
    def set_tenant_id(tenant_id: UUID) -> None:
        """Set the current tenant ID"""
        _tenant_id_ctx.set(tenant_id)
    
    @staticmethod
    def get_tenant_id() -> Optional[UUID]:
        """Get the current tenant ID"""
        return _tenant_id_ctx.get()
    
    @staticmethod
    def set_user_id(user_id: UUID) -> None:
        """Set the current user ID"""
        _user_id_ctx.set(user_id)
    
    @staticmethod
    def get_user_id() -> Optional[UUID]:
        """Get the current user ID"""
        return _user_id_ctx.get()
    
    @staticmethod
    def set_request_id(request_id: str) -> None:
        """Set the current request ID"""
        _request_id_ctx.set(request_id)
    
    @staticmethod
    def get_request_id() -> Optional[str]:
        """Get the current request ID"""
        return _request_id_ctx.get()
    
    @staticmethod
    def clear() -> None:
        """Clear all context variables"""
        _tenant_id_ctx.set(None)
        _user_id_ctx.set(None)
        _request_id_ctx.set(None)
    
    @staticmethod
    def get_context_data() -> dict:
        """Get all context data as a dictionary"""
        return {
            "tenant_id": _tenant_id_ctx.get(),
            "user_id": _user_id_ctx.get(),
            "request_id": _request_id_ctx.get(),
        }
