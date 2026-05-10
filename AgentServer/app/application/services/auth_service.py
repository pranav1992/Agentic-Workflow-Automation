"""
Authentication service
"""
from datetime import datetime, timedelta
from uuid import UUID
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.infrastructure.db.auth_models import User, Tenant
from app.core.security import JWTManager, EncryptionManager
from app.core.constants import UserRole


class AuthService:
    """Service for authentication operations"""
    
    def __init__(self, db: Session):
        self.db = db
        self.jwt_manager = JWTManager()
        self.encryption = EncryptionManager()
    
    def create_user(
        self,
        tenant_id: UUID,
        email: str,
        username: str,
        password: str,
        full_name: Optional[str] = None,
        role: UserRole = UserRole.OPERATOR
    ) -> User:
        """Create a new user"""
        # Check if user already exists
        existing = self.db.query(User).filter(
            User.email == email,
            User.tenant_id == tenant_id
        ).first()
        
        if existing:
            raise ValueError(f"User {email} already exists in tenant")
        
        # Hash password
        password_hash, salt = self.encryption.hash_value(password)
        
        user = User(
            tenant_id=tenant_id,
            email=email,
            username=username,
            full_name=full_name,
            password_hash=password_hash,
            password_salt=salt,
            role=role,
            is_active=True,
            is_verified=True,
        )
        
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user
    
    def authenticate_user(self, email: str, password: str, tenant_id: UUID) -> Optional[User]:
        """Authenticate user with email and password"""
        user = self.db.query(User).filter(
            User.email == email,
            User.tenant_id == tenant_id,
            User.is_active == True
        ).first()
        
        if not user:
            return None
        
        # Verify password
        if not self.encryption.verify_hash(password, user.password_hash, user.password_salt):
            return None
        
        # Update last login
        user.last_login = datetime.now()
        self.db.commit()
        
        return user
    
    def create_access_token(self, user_id: UUID, tenant_id: UUID, role: UserRole) -> str:
        """Create JWT access token"""
        data = {
            "sub": str(user_id),
            "tenant_id": str(tenant_id),
            "role": role.value,
            "type": "access"
        }
        return self.jwt_manager.create_access_token(data)
    
    def verify_token(self, token: str) -> Optional[dict]:
        """Verify and decode JWT token"""
        return self.jwt_manager.decode_token(token)
    
    def get_user(self, user_id: UUID) -> Optional[User]:
        """Get user by ID"""
        return self.db.query(User).filter(User.id == user_id).first()
