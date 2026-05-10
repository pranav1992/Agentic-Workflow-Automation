"""
Security utilities including JWT, RBAC, and encryption
"""
import os
import hmac
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from uuid import UUID
import jwt
from functools import lru_cache

from app.core.constants import UserRole, PermissionScope


class JWTManager:
    """JWT token management"""
    
    def __init__(self, secret_key: Optional[str] = None, algorithm: str = "HS256"):
        self.secret_key = secret_key or os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-prod")
        self.algorithm = algorithm
        self.access_token_expire_minutes = int(os.getenv("JWT_EXPIRE_MINUTES", "30"))
    
    def create_access_token(self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create a JWT access token"""
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(minutes=self.access_token_expire_minutes)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def decode_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Decode and validate JWT token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None


class RBACManager:
    """Role-Based Access Control management"""
    
    # Define role permissions mapping
    ROLE_PERMISSIONS: Dict[UserRole, set[PermissionScope]] = {
        UserRole.ADMIN: set(PermissionScope),  # All permissions
        UserRole.TENANT_ADMIN: {
            PermissionScope.WORKFLOW_CREATE,
            PermissionScope.WORKFLOW_READ,
            PermissionScope.WORKFLOW_UPDATE,
            PermissionScope.WORKFLOW_DELETE,
            PermissionScope.AGENT_CREATE,
            PermissionScope.AGENT_READ,
            PermissionScope.AGENT_UPDATE,
            PermissionScope.AGENT_DELETE,
            PermissionScope.TOOL_CREATE,
            PermissionScope.TOOL_READ,
            PermissionScope.TOOL_UPDATE,
            PermissionScope.TOOL_DELETE,
            PermissionScope.USER_CREATE,
            PermissionScope.USER_READ,
            PermissionScope.USER_UPDATE,
            PermissionScope.USER_DELETE,
        },
        UserRole.OPERATOR: {
            PermissionScope.WORKFLOW_READ,
            PermissionScope.WORKFLOW_UPDATE,
            PermissionScope.AGENT_READ,
            PermissionScope.AGENT_UPDATE,
            PermissionScope.TOOL_READ,
            PermissionScope.WORKFLOW_EXECUTE,
        },
        UserRole.AGENT: {
            PermissionScope.WORKFLOW_READ,
            PermissionScope.WORKFLOW_EXECUTE,
            PermissionScope.AGENT_READ,
            PermissionScope.TOOL_READ,
        },
        UserRole.SERVICE_ACCOUNT: {
            PermissionScope.WORKFLOW_READ,
            PermissionScope.WORKFLOW_EXECUTE,
            PermissionScope.AGENT_READ,
            PermissionScope.TOOL_READ,
        },
    }
    
    @classmethod
    def has_permission(cls, role: UserRole, permission: PermissionScope) -> bool:
        """Check if role has permission"""
        permissions = cls.ROLE_PERMISSIONS.get(role, set())
        return permission in permissions
    
    @classmethod
    def get_role_permissions(cls, role: UserRole) -> set[PermissionScope]:
        """Get all permissions for a role"""
        return cls.ROLE_PERMISSIONS.get(role, set()).copy()


class EncryptionManager:
    """Data encryption utilities"""
    
    @staticmethod
    def hash_value(value: str, salt: Optional[str] = None) -> tuple[str, str]:
        """Hash a value with PBKDF2"""
        if salt is None:
            salt = os.urandom(32).hex()
        
        hash_obj = hashlib.pbkdf2_hmac(
            'sha256',
            value.encode('utf-8'),
            bytes.fromhex(salt),
            100000
        )
        return hash_obj.hex(), salt
    
    @staticmethod
    def verify_hash(value: str, hash_str: str, salt: str) -> bool:
        """Verify a hashed value"""
        hash_obj = hashlib.pbkdf2_hmac(
            'sha256',
            value.encode('utf-8'),
            bytes.fromhex(salt),
            100000
        )
        return hmac.compare_digest(hash_obj.hex(), hash_str)


@lru_cache(maxsize=1)
def get_jwt_manager() -> JWTManager:
    """Get JWT manager singleton"""
    return JWTManager()


def get_rbac_manager() -> RBACManager:
    """Get RBAC manager"""
    return RBACManager()


def get_encryption_manager() -> EncryptionManager:
    """Get encryption manager"""
    return EncryptionManager()
