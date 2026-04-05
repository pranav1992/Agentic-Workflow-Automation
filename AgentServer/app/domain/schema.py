from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from app.infrastructure.db.models import NodeType


class WorkflowCreate(BaseModel):
    name: str


class WorkflowResponse(BaseModel):

    id: UUID
    name: str
    created_at: datetime
    name_lower: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class NodeConfigCreate(BaseModel):
    type: NodeType
    workflow_id: UUID
    config: Dict[str, Any] = Field(
        default_factory=dict,
        alias="metadata",
        serialization_alias="metadata",
        validation_alias="config",
    )
    model_config = ConfigDict(populate_by_name=True, extra="allow")


class NodeConfigResponse(BaseModel):
    id: UUID
    type: NodeType
    workflow_id: UUID
    config: Dict[str, Any] = Field(
        default_factory=dict,
        alias="metadata",
        serialization_alias="metadata",
        validation_alias="config",
    )
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class InititialAgent(BaseModel):
    name: str
    workflow_id: UUID
    isInitial: bool
    model_config = ConfigDict(populate_by_name=True)


class AgentCreate(BaseModel):
    name: str
    workflow_id: UUID


class AgentPayload(BaseModel):
    agent: AgentCreate
    agent_config: NodeConfigCreate
    model_config = ConfigDict(populate_by_name=True)


class Agentresponse(BaseModel):
    id: UUID
    name: str
    workflow_id: UUID
    isInitial: Optional[bool]
    model: str
    temperature: float
    instructions: str
    gaurdrails: str
    model_config = ConfigDict(from_attributes=True)


class PositionCreate(BaseModel):
    workflow_id: UUID
    x: float
    y: float
    agent_id: UUID | None = None
    tool_id: UUID | None = None


class PositionUpdate(PositionCreate):
    id: UUID


class PositionResponse(BaseModel):
    id: UUID
    workflow_id: UUID
    x: float
    y: float
    model_config = ConfigDict(from_attributes=True)


class AgentWithPositionResponse(BaseModel):
    id: UUID
    name: str
    workflow_id: UUID
    isInitial: Optional[bool] = None

    # read from ORM attribute `position_node` but serialize as `position`
    position: Optional[PositionResponse] = Field(
        default=None, validation_alias="position_node"
    )
    config: Optional[NodeConfigResponse] = Field(
        default=None, validation_alias="node_config"
    )
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        alias_generator=None,
        json_encoders={UUID: str},
    )


class ToolCreate(BaseModel):
    name: str
    workflow_id: UUID
    agent_id: UUID
    method: str


class ToolPayload(BaseModel):
    tool: ToolCreate
    tool_config: NodeConfigCreate

    model_config = ConfigDict(populate_by_name=True)


class ToolWithPositionResponse(BaseModel):
    id: UUID
    name: str
    workflow_id: UUID

    # read from ORM attribute `position_node` but serialize as `position`
    position: Optional[PositionResponse] = Field(
        default=None, validation_alias="position_node"
    )
    config: Optional[NodeConfigResponse] = Field(
        default=None, validation_alias="node_config"
    )
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        alias_generator=None,
        json_encoders={UUID: str},
    )


class CombinedNodesResponse(BaseModel):
    agents: list[AgentWithPositionResponse]
    tools: list[ToolWithPositionResponse]


class EdgeCreate(BaseModel):
    id: Optional[UUID] = None
    source: UUID
    target: UUID
    workflow_id: UUID
    data: Optional[Dict[str, Any]] = None
    model_config = ConfigDict(populate_by_name=True, extra="allow")


class EdgeResponse(BaseModel):
    id: UUID
    source: UUID
    target: UUID
    workflow_id: UUID
    data: Optional[Dict[str, Any]] = None
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        alias_generator=None,
        json_encoders={UUID: str},
    )
