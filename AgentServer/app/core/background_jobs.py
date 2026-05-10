"""
Background jobs and async task processing
"""
from typing import Optional, Any, Dict, Callable
from datetime import datetime
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, ForeignKey, Index
from enum import Enum as PyEnum
import json


class TaskStatus(str, PyEnum):
    """Task status enumeration"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRY = "retry"


class BackgroundTask(SQLModel, table=True):
    """Background task model for job tracking"""
    __tablename__ = "background_task"
    __table_args__ = (
        Index("idx_task_tenant", "tenant_id"),
        Index("idx_task_status", "status"),
        Index("idx_task_created_at", "created_at"),
    )
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field()
    name: str = Field(max_length=255)
    task_type: str = Field(max_length=100)
    status: TaskStatus = Field(default=TaskStatus.PENDING)
    payload: Dict[str, Any] = Field(default_factory=dict)
    result: Optional[Dict[str, Any]] = Field(default=None)
    error_message: Optional[str] = Field(default=None)
    retry_count: int = Field(default=0)
    max_retries: int = Field(default=3)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    started_at: Optional[datetime] = Field(default=None)
    completed_at: Optional[datetime] = Field(default=None)


class TaskQueue:
    """Simple in-memory task queue for background jobs"""
    
    def __init__(self):
        self.queue: Dict[str, Callable] = {}
        self.tasks: Dict[UUID, BackgroundTask] = {}
    
    def register_task(self, task_name: str, handler: Callable) -> None:
        """Register a task handler"""
        self.queue[task_name] = handler
    
    def enqueue_task(
        self,
        tenant_id: UUID,
        task_name: str,
        payload: Dict[str, Any],
        max_retries: int = 3,
    ) -> BackgroundTask:
        """Enqueue a task"""
        task = BackgroundTask(
            tenant_id=tenant_id,
            name=task_name,
            task_type=task_name,
            payload=payload,
            max_retries=max_retries,
        )
        self.tasks[task.id] = task
        return task
    
    def get_task(self, task_id: UUID) -> Optional[BackgroundTask]:
        """Get task by ID"""
        return self.tasks.get(task_id)
    
    def get_handler(self, task_name: str) -> Optional[Callable]:
        """Get task handler"""
        return self.queue.get(task_name)


# Global task queue instance
_task_queue = TaskQueue()


def get_task_queue() -> TaskQueue:
    """Get global task queue"""
    return _task_queue


# Pre-defined background job types
BACKGROUND_JOBS = {
    "workflow_execution": "Execute workflow",
    "agent_training": "Train agent",
    "data_export": "Export data",
    "cleanup": "Cleanup old records",
    "email_notification": "Send email notification",
}
