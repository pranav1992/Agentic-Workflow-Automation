"""
Authentication service
"""
import re
import secrets
from datetime import datetime, timedelta
from uuid import UUID
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.infrastructure.db.auth_models import User, Tenant
from app.core.security import JWTManager, EncryptionManager
from app.core.constants import UserRole
from app.core.settings import get_settings
from app.domain.exceptions import AccountLockedError


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "org"


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

    def register_new_tenant(
        self,
        tenant_name: str,
        email: str,
        password: str,
        full_name: Optional[str] = None,
    ) -> tuple[User, Tenant]:
        """Self-registration: always creates a brand-new tenant (there's
        no "join an existing organization" flow) with this user as its
        first admin, then seeds the demo workflow into it so the new
        tenant never lands on an empty workflow list — the same seeding
        scripts/create_user.py does for operator-created accounts.
        """
        # Import locally: workflow_clone_service pulls in domain models
        # this module doesn't otherwise need, and doing it at call time
        # avoids a needless import for every other AuthService method.
        from app.application.services.workflow_clone_service import (
            clone_workflow_to_tenant,
            DEMO_WORKFLOW_NAME,
            DEMO_SOURCE_TENANT_SLUG,
        )

        base_slug = _slugify(tenant_name)
        slug = base_slug
        while self.db.query(Tenant).filter(Tenant.slug == slug).first():
            slug = f"{base_slug}-{secrets.token_hex(3)}"

        tenant = Tenant(name=tenant_name, slug=slug)
        self.db.add(tenant)
        self.db.flush()

        user = self.create_user(
            tenant_id=tenant.id,
            email=email,
            username=email.split("@")[0],
            password=password,
            full_name=full_name,
            role=UserRole.ADMIN,
        )

        from app.infrastructure.db.models import WorkFlow

        source_tenant = self.db.query(Tenant).filter(
            Tenant.slug == DEMO_SOURCE_TENANT_SLUG
        ).first()
        if source_tenant:
            demo_workflow = self.db.query(WorkFlow).filter_by(
                tenant_id=source_tenant.id, name=DEMO_WORKFLOW_NAME
            ).first()
            if demo_workflow:
                clone_workflow_to_tenant(self.db, demo_workflow.id, tenant.id)
                self.db.commit()

        return user, tenant
    
    def authenticate_user_by_email(self, email: str, password: str) -> Optional[User]:
        """Authenticate a user by email alone, without a known tenant.

        Email is only unique per-tenant, so this is a best-effort lookup for
        the sign-in form (which has no tenant selector): it matches active
        users by email and accepts the first whose password verifies.

        Per-account lockout here is independent of (and on top of) the
        per-IP login rate limit in LoginRateLimitMiddleware — that one
        alone lets a distributed attacker (many IPs) still brute-force one
        specific account at the per-IP rate.
        """
        settings = get_settings()
        now = datetime.now()

        candidates = self.db.query(User).filter(
            User.email == email,
            User.is_active == True
        ).all()

        locked_candidate = None
        for user in candidates:
            if user.locked_until and user.locked_until > now:
                locked_candidate = user
                continue

            if self.encryption.verify_hash(password, user.password_hash, user.password_salt):
                user.failed_login_attempts = 0
                user.locked_until = None
                user.last_login = now
                self.db.commit()
                return user

            user.failed_login_attempts += 1
            if user.failed_login_attempts >= settings.ACCOUNT_LOCKOUT_THRESHOLD:
                user.locked_until = now + timedelta(
                    seconds=settings.ACCOUNT_LOCKOUT_DURATION_SECONDS
                )
                locked_candidate = user
            self.db.commit()

        if locked_candidate is not None:
            retry_after = int((locked_candidate.locked_until - now).total_seconds())
            raise AccountLockedError(retry_after)

        return None

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
    
    def create_access_token(
        self, user_id: UUID, tenant_id: UUID, role: UserRole, token_version: int = 0
    ) -> str:
        """Create JWT access token"""
        data = {
            "sub": str(user_id),
            "tenant_id": str(tenant_id),
            "role": role.value,
            "type": "access",
            # Checked against User.token_version in get_current_user —
            # bumping that column (on logout) invalidates every token
            # issued before the bump, even ones that haven't expired yet.
            "tv": token_version,
        }
        return self.jwt_manager.create_access_token(data)

    def revoke_all_tokens(self, user: User) -> None:
        """Invalidate every outstanding token for this user (logout)."""
        user.token_version += 1
        self.db.commit()
    
    def verify_token(self, token: str) -> Optional[dict]:
        """Verify and decode JWT token"""
        return self.jwt_manager.decode_token(token)
    
    def get_user(self, user_id: UUID) -> Optional[User]:
        """Get user by ID"""
        return self.db.query(User).filter(User.id == user_id).first()
