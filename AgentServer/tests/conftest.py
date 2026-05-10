"""
Pytest configuration and fixtures
"""
import pytest
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlmodel import SQLModel

# Import all models to ensure they're registered
from app.infrastructure.db.models import WorkFlow, Agent, Tool, Edge, HandOff, PositionNode, NodeConfig
from app.infrastructure.db.auth_models import Tenant, User, AuditLog


@pytest.fixture(scope="session")
def test_db_engine():
    \"\"\"Create test database engine\"\"\"
    # Use SQLite for testing
    database_url = "sqlite:///:memory:"
    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False},
        echo=False,
    )
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture
def db_session(test_db_engine):
    \"\"\"Create test database session\"\"\"
    Session = sessionmaker(bind=test_db_engine)
    session = Session()
    
    yield session
    
    session.rollback()
    session.close()


@pytest.fixture(autouse=True)
def clear_context():
    \"\"\"Clear tenant context after each test\"\"\"
    from app.core.tenancy import TenantContext
    
    yield
    
    TenantContext.clear()


@pytest.fixture
def override_settings(monkeypatch):
    \"\"\"Override settings for testing\"\"\"
    def set_setting(key: str, value):
        monkeypatch.setenv(key, str(value))
    
    return set_setting
