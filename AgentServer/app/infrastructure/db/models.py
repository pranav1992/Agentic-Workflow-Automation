from datetime import datetime
from enum import Enum as PyEnum
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, Dict, Any
from uuid import uuid4, UUID
from sqlalchemy import (
    Column,
    Enum as SAEnum,
    UniqueConstraint,
    ForeignKey,
    CheckConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB


class NodeType(str, PyEnum):
    AGENT = "agent"
    TOOL = "tool"


class WorkFlow(SQLModel, table=True):  # Persistent Memory / history
    __tablename__ = "workflow"
    __table_args__ = (UniqueConstraint("name_lower", name="uq_workflow_name"),)
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(max_length=200, index=True)
    name_lower: Optional[str] = Field(default=None, max_length=200, index=True)
    created_at: datetime = Field(
        default_factory=datetime.now,
        description="Timestamp the snapshot was stored.",
    )
    agents: list["Agent"] = Relationship(
        back_populates="workflow",
        sa_relationship_kwargs={"lazy": "select", "passive_deletes": True}
    )
    hand_offs: list["HandOff"] = Relationship(
        back_populates="workflow",
        sa_relationship_kwargs={"lazy": "select"}
    )

    def __init__(self, **data):
        # ensure the canonical lower-case name is always populated
        if "name" in data and not data.get("name_lower"):
            data["name_lower"] = data["name"].lower()
        super().__init__(**data)


class PositionNode(SQLModel, table=True):
    __tablename__ = "positionnode"
    __table_args__ = (
        CheckConstraint(
            "(agent_id IS NOT NULL AND tool_id IS NULL) OR "
            "(agent_id IS NULL AND tool_id IS NOT NULL)",
            name="only_one_position_type",
        ),
    )
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    workflow_id: UUID = Field(
        sa_column=Column(ForeignKey("workflow.id", ondelete="CASCADE"))
    )
    agent_id: Optional[UUID] = Field(
        sa_column=Column(ForeignKey("agent.id", ondelete="CASCADE"))
    )
    tool_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(ForeignKey("tool.id", ondelete="CASCADE"))
    )
    agent: Optional["Agent"] = Relationship(
        back_populates="position_node",
        sa_relationship_kwargs={"foreign_keys": "[PositionNode.agent_id]"},
    )
    tool: Optional["Tool"] = Relationship(
        back_populates="position_node",
        sa_relationship_kwargs={"foreign_keys": "[PositionNode.tool_id]"},
    )
    x: float
    y: float


class NodeConfig(SQLModel, table=True):
    __tablename__ = "nodeconfig"
    __table_args__ = (
        CheckConstraint(
            "(agent_id IS NOT NULL AND tool_id IS NULL) OR "
            "(agent_id IS NULL AND tool_id IS NOT NULL)",
            name="only_one_node_type",
        ),
    )
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    type: NodeType = Field(
        sa_column=Column(SAEnum(NodeType, name="node_type"), nullable=False)
    )
    workflow_id: UUID = Field(
        sa_column=Column(ForeignKey("workflow.id", ondelete="CASCADE"))
    )
    agent_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(ForeignKey("agent.id", ondelete="CASCADE")),
    )
    tool_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(ForeignKey("tool.id", ondelete="CASCADE"))
    )
    agent: Optional["Agent"] = Relationship(
        back_populates="node_config",
        sa_relationship_kwargs={"foreign_keys": "[NodeConfig.agent_id]"},
    )
    tool: Optional["Tool"] = Relationship(
        back_populates="node_config",
        sa_relationship_kwargs={"foreign_keys": "[NodeConfig.tool_id]"},
    )
    config: Dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column("metadata", JSONB, nullable=False),
        description="Tool config / schema",
        alias="metadata",
    )


class Agent(SQLModel, table=True):
    __tablename__ = "agent"
    __table_args__ = (
        UniqueConstraint("workflow_id", "name", name="uq_agent_workflow_name"),
    )
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(max_length=200, index=True)
    workflow_id: UUID = Field(sa_column=Column(
        ForeignKey("workflow.id", ondelete="CASCADE")))
    workflow: Optional[WorkFlow] = Relationship(back_populates="agents")
    position: UUID | None = Field(default=None, foreign_key="positionnode.id")
    config: UUID | None = Field(default=None, foreign_key="nodeconfig.id")
    isInitial: Optional[bool] = Field(default=False)
    position_node: Optional[PositionNode] = Relationship(
        sa_relationship_kwargs={
            "lazy": "joined", "foreign_keys": "[PositionNode.agent_id]"},
        back_populates="agent"
    )
    node_config: Optional[NodeConfig] = Relationship(
        sa_relationship_kwargs={
            "lazy": "joined", "foreign_keys": "[NodeConfig.agent_id]"},
        back_populates="agent"
    )
    tool_nodes: list["Tool"] = Relationship(
        sa_relationship_kwargs={
            "lazy": "select",
            "foreign_keys": "Tool.agent_id",
        },
        back_populates="agent",
    )


class Tool(SQLModel, table=True):
    __tablename__ = "tool"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(max_length=200, index=True)
    workflow_id: UUID = Field(
        sa_column=Column(ForeignKey("workflow.id", ondelete="CASCADE"))
    )
    agent_id: UUID = Field(foreign_key="agent.id")
    method: str = Field(max_length=10)
    node_config: Optional[NodeConfig] = Relationship(
        back_populates="tool",
        sa_relationship_kwargs={
            "lazy": "joined",
            "primaryjoin": "NodeConfig.tool_id==Tool.id",
            "foreign_keys": "[NodeConfig.tool_id]",
            "uselist": False,
        },
    )
    agent: Optional[Agent] = Relationship(
        back_populates="tool_nodes",
        sa_relationship_kwargs={"foreign_keys": "[Tool.agent_id]"},
    )
    position_node: Optional[PositionNode] = Relationship(
        back_populates="tool",
        sa_relationship_kwargs={
            "lazy": "joined",
            "primaryjoin": "PositionNode.tool_id==Tool.id",
            "foreign_keys": "[PositionNode.tool_id]",
        },
    )


class HandOff(SQLModel, table=True):
    __tablename__ = "handoff"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(max_length=200, index=True)
    workflow_id: UUID = Field(
        sa_column=Column(ForeignKey("workflow.id", ondelete="CASCADE"))
    )
    workflow: WorkFlow = Relationship(back_populates="hand_offs")
    meta: Dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column("metadata", JSONB, nullable=False),
        description="Workflow graph payload from UI (nodes, edges, metadata).",
    )
