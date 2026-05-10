"""
Example test file demonstrating the new testing structure
"""
import pytest
from uuid import uuid4
from sqlalchemy.orm import Session
from app.infrastructure.db.auth_models import Tenant, User
from app.application.services.auth_service import AuthService
from app.core.constants import UserRole
from app.core.tenancy import TenantContext


@pytest.fixture
def db_session():
    \"\"\"Fixture for database session\"\"\"
    # Create test database session
    # Use in-memory SQLite for tests
    pass


@pytest.fixture
def test_tenant(db_session: Session) -> Tenant:
    \"\"\"Create test tenant\"\"\"
    tenant = Tenant(
        name=\"Test Tenant\",
        slug=\"test-tenant\",
        is_active=True,
    )
    db_session.add(tenant)
    db_session.commit()
    return tenant


@pytest.fixture
def test_user(db_session: Session, test_tenant: Tenant) -> User:
    \"\"\"Create test user\"\"\"
    auth_service = AuthService(db_session)
    user = auth_service.create_user(
        tenant_id=test_tenant.id,
        email=\"test@example.com\",
        username=\"testuser\",
        password=\"secure_password_123\",
        full_name=\"Test User\",
        role=UserRole.OPERATOR,
    )
    return user


class TestAuthService:
    \"\"\"Test authentication service\"\"\"
    
    def test_create_user(self, db_session: Session, test_tenant: Tenant):
        \"\"\"Test user creation\"\"\"
        auth_service = AuthService(db_session)
        
        user = auth_service.create_user(
            tenant_id=test_tenant.id,
            email=\"newuser@example.com\",
            username=\"newuser\",
            password=\"password123\",
        )
        
        assert user is not None
        assert user.email == \"newuser@example.com\"
        assert user.tenant_id == test_tenant.id
    
    def test_authenticate_user(self, db_session: Session, test_user: User, test_tenant: Tenant):
        \"\"\"Test user authentication\"\"\"
        auth_service = AuthService(db_session)
        
        authenticated_user = auth_service.authenticate_user(
            email=test_user.email,
            password=\"secure_password_123\",
            tenant_id=test_tenant.id,
        )
        
        assert authenticated_user is not None
        assert authenticated_user.id == test_user.id
    
    def test_create_access_token(self, test_user: User, test_tenant: Tenant):
        \"\"\"Test token creation\"\"\"
        auth_service = AuthService(None)  # Token creation doesn't need DB
        
        token = auth_service.create_access_token(
            user_id=test_user.id,
            tenant_id=test_tenant.id,
            role=test_user.role,
        )
        
        assert token is not None
        assert isinstance(token, str)
        
        # Verify token
        claims = auth_service.verify_token(token)
        assert claims is not None
        assert claims[\"sub\"] == str(test_user.id)


class TestTenantIsolation:
    \"\"\"Test tenant isolation\"\"\"
    
    def test_tenant_context_management(self):
        \"\"\"Test setting and getting tenant context\"\"\"
        tenant_id = uuid4()
        user_id = uuid4()
        request_id = \"req-123\"
        
        TenantContext.set_tenant_id(tenant_id)
        TenantContext.set_user_id(user_id)
        TenantContext.set_request_id(request_id)
        
        assert TenantContext.get_tenant_id() == tenant_id
        assert TenantContext.get_user_id() == user_id
        assert TenantContext.get_request_id() == request_id
        
        # Clean up
        TenantContext.clear()
        assert TenantContext.get_tenant_id() is None


if __name__ == \"__main__\":
    pytest.main([__file__, \"-v\"])
