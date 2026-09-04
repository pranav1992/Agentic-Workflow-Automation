from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field
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
    # Accept either "metadata" (the wire contract used everywhere else —
    # this is what the response models below serialize as) or the bare
    # field name "config", so a client sending the documented "metadata"
    # key always actually lands in `.config` instead of silently falling
    # through to an unused extra attribute.
    config: Dict[str, Any] = Field(
        default_factory=dict,
        validation_alias=AliasChoices("metadata", "config"),
        serialization_alias="metadata",
    )
    model_config = ConfigDict(populate_by_name=True, extra="allow")


class NodeConfigResponse(BaseModel):
    id: UUID
    type: NodeType
    workflow_id: UUID
    # NOTE: this is populated via from_attributes off the NodeConfig ORM
    # object, never off a plain dict — so validation_alias must stay
    # "config" only. Every SQLAlchemy mapped instance carries its own
    # class-level `.metadata` attribute (the schema registry); adding
    # "metadata" to this alias makes attribute lookup silently pick up
    # that unrelated object instead of raising, which serializes into a
    # ResponseValidationError instead of our actual data.
    config: Dict[str, Any] = Field(
        default_factory=dict,
        validation_alias="config",
        serialization_alias="metadata",
    )
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class InititialAgent(BaseModel):
    name: str
    workflow_id: UUID
    isInitial: bool
    model_config = ConfigDict(populate_by_name=True)


class AgentCreate(BaseModel):
    id: Optional[UUID] = None
    name: str
    workflow_id: UUID
    isInitial: Optional[bool] = None


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
    id: Optional[UUID] = None
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


class WorkflowLaunchResponse(BaseModel):
    session_id: UUID
    room_name: str
    token: str
    livekit_url: str


class WorkflowSessionResponse(BaseModel):
    id: UUID
    workflow_id: UUID
    room_name: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    status: str
    duration_seconds: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_orm_with_duration(cls, obj) -> "WorkflowSessionResponse":
        instance = cls.model_validate(obj)
        if obj.ended_at and obj.started_at:
            instance.duration_seconds = int(
                (obj.ended_at - obj.started_at).total_seconds()
            )
        return instance


class WorkflowStatusResponse(BaseModel):
    status: str  # "active" | "idle"
    session_id: Optional[UUID] = None
    room_name: Optional[str] = None
    started_at: Optional[datetime] = None
