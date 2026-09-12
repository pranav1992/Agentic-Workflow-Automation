from .base import DomainError


class DatabaseUnavailableError(DomainError):
    code = "DATABASE_UNAVAILABLE"

    def __init__(self, message: str = "Database is unavailable"):
        super().__init__(message)


class SystemConfigurationError(DomainError):
    code = "SYSTEM_CONFIGURATION_ERROR"

    def __init__(self, message: str = "System configuration error"):
        super().__init__(message)


class TenantRequiredError(DomainError):
    """Raised when a tenant-scoped operation runs with no tenant on
    TenantContext. Every route that reaches this runs behind
    get_current_user, whose JWT always carries a tenant_id — hitting this
    means that invariant broke (e.g. TenantIsolationMiddleware not
    registered), not that the caller is merely unauthenticated.
    """
    code = "TENANT_REQUIRED"

    def __init__(self, message: str = "No tenant context for this request"):
        super().__init__(message)
