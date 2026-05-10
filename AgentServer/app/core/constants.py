"""
Application constants and enumerations
"""
from enum import Enum


class Environment(str, Enum):
    """Application environment"""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TESTING = "testing"


class LogLevel(str, Enum):
    """Log level enum"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class UserRole(str, Enum):
    """User role enumeration for RBAC"""
    ADMIN = "admin"
    TENANT_ADMIN = "tenant_admin"
    OPERATOR = "operator"
    AGENT = "agent"
    SERVICE_ACCOUNT = "service_account"


class PermissionScope(str, Enum):
    """Permission scopes for RBAC"""
    # Workflow permissions
    WORKFLOW_CREATE = "workflow:create"
    WORKFLOW_READ = "workflow:read"
    WORKFLOW_UPDATE = "workflow:update"
    WORKFLOW_DELETE = "workflow:delete"
    WORKFLOW_EXECUTE = "workflow:execute"
    
    # Agent permissions
    AGENT_CREATE = "agent:create"
    AGENT_READ = "agent:read"
    AGENT_UPDATE = "agent:update"
    AGENT_DELETE = "agent:delete"
    
    # Tool permissions
    TOOL_CREATE = "tool:create"
    TOOL_READ = "tool:read"
    TOOL_UPDATE = "tool:update"
    TOOL_DELETE = "tool:delete"
    
    # Tenant management
    TENANT_READ = "tenant:read"
    TENANT_UPDATE = "tenant:update"
    TENANT_DELETE = "tenant:delete"
    
    # User management
    USER_CREATE = "user:create"
    USER_READ = "user:read"
    USER_UPDATE = "user:update"
    USER_DELETE = "user:delete"


class AuditAction(str, Enum):
    """Audit log actions"""
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    EXECUTE = "execute"
    LOGIN = "login"
    LOGOUT = "logout"
    PERMISSION_DENIED = "permission_denied"
