from __future__ import annotations

import json
from dataclasses import dataclass, field
from uuid import UUID

from sqlmodel import Session

from app.infrastructure.db.engine import engine
from app.application.facade.workflow_facade import WorkflowFacade
from app.application.services.edge_service import EdgeService
from app.infrastructure.repository.edge import EdgeRepository

from agents.prompts.prompts import WELCOME_MESSAGE as _DEFAULT_WELCOME

_DEFAULT_INSTRUCTIONS = (
    "You are the manager of a call center for an automotive service center. "
    "Help the customer by answering their questions or routing them to the correct department."
)


@dataclass
class RuntimeTool:
    id: UUID
    name: str
    method: str
    agent_id: UUID
    config: dict = field(default_factory=dict)


@dataclass
class RuntimeEdge:
    id: UUID
    source_position_id: UUID
    target_position_id: UUID
    handoff_type: str = "always"
    condition: str = ""
    timeout_seconds: int = 0
    notes: str = ""


@dataclass
class RuntimeAgent:
    id: UUID
    name: str
    is_initial: bool
    instructions: str
    welcome_message: str
    model: str
    temperature: float
    max_tokens: int
    language: str
    position_id: UUID | None
    tools: list[RuntimeTool] = field(default_factory=list)


@dataclass
class RuntimeWorkflow:
    id: UUID
    name: str
    agents: list[RuntimeAgent]
    edges: list[RuntimeEdge]

    @property
    def initial_agent(self) -> RuntimeAgent | None:
        return next((a for a in self.agents if a.is_initial), None)

    def successors(self, agent: RuntimeAgent) -> list[tuple[RuntimeAgent, RuntimeEdge]]:
        """Return (agent, edge) pairs reachable from the given agent via its position_id."""
        if agent.position_id is None:
            return []
        results = []
        for edge in self.edges:
            if edge.source_position_id == agent.position_id:
                target = next(
                    (a for a in self.agents if a.position_id == edge.target_position_id),
                    None,
                )
                if target:
                    results.append((target, edge))
        return results


class WorkflowLoader:
    """Loads a workflow graph from the database into plain dataclasses
    suitable for use by the LiveKit worker (no FastAPI dependency injection)."""

    def load(self, workflow_id: str | UUID) -> RuntimeWorkflow:
        with Session(engine) as session:
            facade = WorkflowFacade(session)
            edge_service = EdgeService(EdgeRepository(session))

            workflow = facade.workflow_service.get_workflow(str(workflow_id))
            nodes = facade.get_all_nodes(str(workflow_id))
            db_edges = edge_service.get_all(str(workflow_id))

            tools_by_agent: dict[str, list[RuntimeTool]] = {}
            for tool in nodes["tools"]:
                tool_config = {}
                if hasattr(tool, "node_config") and tool.node_config:
                    tool_config = tool.node_config.config or {}
                agent_key = str(tool.agent_id)
                tools_by_agent.setdefault(agent_key, []).append(
                    RuntimeTool(
                        id=tool.id,
                        name=tool.name,
                        method=tool.method,
                        agent_id=tool.agent_id,
                        config=tool_config,
                    )
                )

            runtime_agents: list[RuntimeAgent] = []
            for agent in nodes["agents"]:
                config: dict = {}
                if hasattr(agent, "node_config") and agent.node_config:
                    config = agent.node_config.config or {}

                position_id = None
                if hasattr(agent, "position_node") and agent.position_node:
                    position_id = agent.position_node.id

                runtime_agents.append(
                    RuntimeAgent(
                        id=agent.id,
                        name=agent.name,
                        is_initial=bool(agent.isInitial),
                        instructions=config.get("systemPrompt") or _DEFAULT_INSTRUCTIONS,
                        welcome_message=config.get("welcomeMessage") or _DEFAULT_WELCOME.strip(),
                        model=config.get("model") or "gpt-realtime",
                        temperature=float(config.get("temperature") or 0.7),
                        max_tokens=int(config.get("maxTokens") or 1024),
                        language=config.get("language") or "en",
                        position_id=position_id,
                        tools=tools_by_agent.get(str(agent.id), []),
                    )
                )

            runtime_edges: list[RuntimeEdge] = []
            for edge in db_edges:
                data: dict = edge.data or {}
                runtime_edges.append(
                    RuntimeEdge(
                        id=edge.id,
                        source_position_id=edge.source,
                        target_position_id=edge.target,
                        handoff_type=data.get("handoffType") or "always",
                        condition=data.get("condition") or "",
                        timeout_seconds=int(data.get("timeoutSeconds") or 0),
                        notes=data.get("notes") or "",
                    )
                )

            return RuntimeWorkflow(
                id=workflow.id,
                name=workflow.name,
                agents=runtime_agents,
                edges=runtime_edges,
            )
