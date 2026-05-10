"""
Audit logging service for compliance and security
"""
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.infrastructure.db.auth_models import AuditLog
from app.core.tenancy import TenantContext
from app.core.constants import AuditAction
from app.core.logging import get_logger

logger = get_logger(__name__)


class AuditLogService:
    """Service for audit logging"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def log_action(
        self,
        action: AuditAction,
        resource_type: str,
        resource_id: Optional[UUID] = None,
        details: Optional[Dict[str, Any]] = None,
        status: str = "success",
        error_message: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AuditLog:
        """
        Log an audit action
        
        Args:
            action: The action performed
            resource_type: Type of resource affected
            resource_id: ID of the resource
            details: Additional details about the action
            status: Status of the action (success, failure, denied)
            error_message: Error message if action failed
            ip_address: IP address of the requester
            user_agent: User agent of the requester
        """
        tenant_id = TenantContext.get_tenant_id()
        user_id = TenantContext.get_user_id()
        
        if not tenant_id:
            logger.warning("Attempt to log audit action without tenant context")
            return None
        
        audit_log = AuditLog(
            tenant_id=tenant_id,
            user_id=user_id,
            action=action.value,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details or {},
            status=status,
            error_message=error_message,
            ip_address=ip_address,
            user_agent=user_agent,
            timestamp=datetime.now(),
        )
        
        try:
            self.db.add(audit_log)
            self.db.commit()
            self.db.refresh(audit_log)
            
            logger.info(
                f"Audit log: {action.value} on {resource_type}",
                action=action.value,
                resource_type=resource_type,
                resource_id=str(resource_id) if resource_id else None,
                status=status,
            )
            
            return audit_log
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to log audit action: {str(e)}")
            return None
    
    def get_audit_logs(
        self,
        tenant_id: UUID,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        user_id: Optional[UUID] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[AuditLog], int]:
        """
        Get audit logs for a tenant
        
        Args:
            tenant_id: Tenant ID
            action: Filter by action
            resource_type: Filter by resource type
            user_id: Filter by user ID
            limit: Number of records to return
            offset: Offset for pagination
        
        Returns:
            Tuple of (audit logs, total count)
        """
        query = self.db.query(AuditLog).filter(AuditLog.tenant_id == tenant_id)
        
        if action:
            query = query.filter(AuditLog.action == action)
        
        if resource_type:
            query = query.filter(AuditLog.resource_type == resource_type)
        
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        
        total = query.count()
        
        logs = query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
        
        return logs, total
