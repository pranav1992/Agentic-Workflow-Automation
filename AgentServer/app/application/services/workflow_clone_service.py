"""Deep-clones a workflow (agents, tools, edges, positions, node configs)
into another tenant.

Tenants are fully isolated (app/core/tenancy.py, TenantContext) — a
workflow row can only ever belong to one tenant. So "make a demo
workflow available to every user" can't mean sharing one workflow
across tenants; it means giving each tenant its own independent copy,
with every foreign key remapped to freshly minted IDs. That's what this
does, in one transaction.
"""
from uuid import UUID, uuid4

from sqlmodel import Session, select

from app.infrastructure.db.models import (
    WorkFlow,
    Agent,
    Tool,
    Edge,
    PositionNode,
    NodeConfig,
)


def clone_workflow_to_tenant(
    session: Session, source_workflow_id: UUID, target_tenant_id: UUID
) -> WorkFlow:
    """Copies the workflow graph rooted at `source_workflow_id` into
    `target_tenant_id` as a brand-new workflow. Does not commit — the
    caller controls the transaction."""

    source = session.get(WorkFlow, source_workflow_id)
    if source is None:
        raise ValueError(f"Source workflow {source_workflow_id} not found")

    new_workflow = WorkFlow(
        id=uuid4(),
        tenant_id=target_tenant_id,
        name=source.name,
    )
    session.add(new_workflow)
    session.flush()

    agents = session.exec(
        select(Agent).where(Agent.workflow_id == source_workflow_id)
    ).all()
    tools = session.exec(
        select(Tool).where(Tool.workflow_id == source_workflow_id)
    ).all()
    positions = session.exec(
        select(PositionNode).where(PositionNode.workflow_id == source_workflow_id)
    ).all()
    configs = session.exec(
        select(NodeConfig).where(NodeConfig.workflow_id == source_workflow_id)
    ).all()
    edges = session.exec(
        select(Edge).where(Edge.workflow_id == source_workflow_id)
    ).all()

    agent_id_map: dict[UUID, UUID] = {a.id: uuid4() for a in agents}
    tool_id_map: dict[UUID, UUID] = {t.id: uuid4() for t in tools}
    position_id_map: dict[UUID, UUID] = {p.id: uuid4() for p in positions}
    config_id_map: dict[UUID, UUID] = {c.id: uuid4() for c in configs}

    # Agents and tools first (without position/config — those rows don't
    # exist yet), then positions/configs pointing back at the now-created
    # agents/tools, then a second pass to set Agent.position/config and
    # Tool.position/config once the targets exist.
    new_agents: dict[UUID, Agent] = {}
    for agent in agents:
        new_agent = Agent(
            id=agent_id_map[agent.id],
            tenant_id=target_tenant_id,
            name=agent.name,
            workflow_id=new_workflow.id,
            isInitial=agent.isInitial,
        )
        session.add(new_agent)
        new_agents[agent.id] = new_agent

    new_tools: dict[UUID, Tool] = {}
    for tool in tools:
        new_tool = Tool(
            id=tool_id_map[tool.id],
            tenant_id=target_tenant_id,
            name=tool.name,
            workflow_id=new_workflow.id,
            agent_id=agent_id_map[tool.agent_id],
            method=tool.method,
        )
        session.add(new_tool)
        new_tools[tool.id] = new_tool

    session.flush()

    for position in positions:
        new_position = PositionNode(
            id=position_id_map[position.id],
            tenant_id=target_tenant_id,
            workflow_id=new_workflow.id,
            agent_id=agent_id_map.get(position.agent_id) if position.agent_id else None,
            tool_id=tool_id_map.get(position.tool_id) if position.tool_id else None,
            x=position.x,
            y=position.y,
        )
        session.add(new_position)

    for config in configs:
        new_config = NodeConfig(
            id=config_id_map[config.id],
            tenant_id=target_tenant_id,
            type=config.type,
            workflow_id=new_workflow.id,
            agent_id=agent_id_map.get(config.agent_id) if config.agent_id else None,
            tool_id=tool_id_map.get(config.tool_id) if config.tool_id else None,
            config=dict(config.config),
        )
        session.add(new_config)

    session.flush()

    for agent in agents:
        if agent.position:
            new_agents[agent.id].position = position_id_map[agent.position]
        if agent.config:
            new_agents[agent.id].config = config_id_map[agent.config]

    for tool in tools:
        if tool.position:
            new_tools[tool.id].position = position_id_map[tool.position]
        if tool.config:
            new_tools[tool.id].config = config_id_map[tool.config]

    for edge in edges:
        session.add(
            Edge(
                id=uuid4(),
                tenant_id=target_tenant_id,
                workflow_id=new_workflow.id,
                source=position_id_map[edge.source],
                target=position_id_map[edge.target],
                data=dict(edge.data) if edge.data else None,
            )
        )

    session.flush()
    return new_workflow
