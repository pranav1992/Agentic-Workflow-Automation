from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    payload: Dict[str, Any]


class WorkflowResponse(BaseModel):

    id: UUID
    name: str
    description: Optional[str] = None
    created_at: datetime
    name_lower: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class InititialAgent(BaseModel):
    name: str
    workflow_id: UUID
    isInitial: bool


class AgentCreate(BaseModel):
    name: str
    workflow_id: UUID


class Agentresponse(BaseModel):
    id: UUID
    name: str
    workflow_id: UUID
    isInitial: Optional[bool]
    model: str
    temperature: float
    instructions: str
    gaurdrails: str
