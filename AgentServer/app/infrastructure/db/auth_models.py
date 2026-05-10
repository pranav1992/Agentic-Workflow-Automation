"""
Authentication and authorization models
"""
from datetime import datetime
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, ForeignKey, Index, UniqueConstraint
from typing import Optional, Dict, Any
from app.core.constants import UserRole
from sqlalchemy.dialects.postgresql import UUID as UUID_TYPE


class Tenant(SQLModel, table=True):
    """Tenant model for multi-tenancy"""
    __tablename__ = "tenant"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_tenant_slug"),
        Index("idx_tenant_created_at", "created_at"),
    )
    
    id: UUID = Field(default_factory=uuid4, primary_key=True, sa_type=UUID_TYPE)
    name: str = Field(max_length=255, index=True)
    slug: str = Field(max_length=100, unique=True)
    description: Optional[str] = Field(default=None, max_length=500)
    is_active: bool = Field(default=True, index=True)
    metadata: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(sa_type=type(None)))
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    # Relationships
    users: list["User"] = Relationship(back_populates="tenant")
    workflows: list["WorkflowTenant"] = Relationship(back_populates="tenant")


class User(SQLModel, table=True):
    """User model with authentication"""
    __tablename__ = "user"
    __table_args__ = (
        UniqueConstraint("email", "tenant_id", name="uq_user_email_tenant"),
        Index("idx_user_tenant", "tenant_id"),
        Index("idx_user_created_at", "created_at"),
    )
    
    id: UUID = Field(default_factory=uuid4, primary_key=True, sa_type=UUID_TYPE)
    tenant_id: UUID = Field(sa_column=Column(ForeignKey("tenant.id", ondelete="CASCADE")))
    email: str = Field(max_length=255, index=True)
    username: str = Field(max_length=100)
    full_name: Optional[str] = Field(default=None, max_length=255)
    password_hash: str = Field()
    password_salt: str = Field()
    role: UserRole = Field(default=UserRole.OPERATOR)
    is_active: bool = Field(default=True, index=True)
    is_verified: bool = Field(default=False)
    last_login: Optional[datetime] = Field(default=None)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    # Relationships
    tenant: Optional[Tenant] = Relationship(back_populates="users")


class AuditLog(SQLModel, table=True):
    """Audit logging for compliance and security"""
    __tablename__ = "audit_log"
    __table_args__ = (
        Index("idx_audit_tenant", "tenant_id"),
        Index("idx_audit_user", "user_id"),
        Index("idx_audit_action", "action"),
        Index("idx_audit_timestamp", "timestamp"),
    )
    
    id: UUID = Field(default_factory=uuid4, primary_key=True, sa_type=UUID_TYPE)
    tenant_id: UUID = Field()
    user_id: Optional[UUID] = Field(default=None)
    action: str = Field(max_length=50)
    resource_type: str = Field(max_length=50)
    resource_id: Optional[UUID] = Field(default=None, sa_type=UUID_TYPE)
    details: Dict[str, Any] = Field(default_factory=dict)
    ip_address: Optional[str] = Field(default=None, max_length=50)
    user_agent: Optional[str] = Field(default=None)
    status: str = Field(default="success", max_length=20)  # success, failure, denied
    error_message: Optional[str] = Field(default=None)
    timestamp: datetime = Field(default_factory=datetime.now, index=True)
