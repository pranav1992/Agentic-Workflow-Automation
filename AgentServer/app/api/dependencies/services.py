from fastapi import Depends
from sqlmodel import Session

from app.infrastructure.db.session import get_session
from app.infrastructure.repository.agent_repository import AgentRepository
from app.infrastructure.repository.workflow_respository import\
                                                         WorkflowRepository
from app.application.services.agent_service import AgentService
from app.application.services.workflow_service import WorkflowService
from app.application.facade.workflow_facade import WorkflowFacade
from app.application.facade.agent_facade import AgentFacade
from app.application.facade.tool_facade import ToolFacade
from app.application.services.edge_service import EdgeService
from app.infrastructure.repository.edge import EdgeRepository
from app.application.services.position_service import PositionService
from app.infrastructure.repository.position_repository import PositionRepository
from app.application.services.tool_service import ToolService
from app.infrastructure.repository.tool_repository import ToolRepository


def get_agent_service(
    session: Session = Depends(get_session)
) -> AgentService:

    repo = AgentRepository(session)

    return AgentService(repo)


def get_workflow_service(
    session: Session = Depends(get_session)
) -> WorkflowService:

    repo = WorkflowRepository(session)

    return WorkflowService(repo)


def get_workflow_facade(
    session: Session = Depends(get_session)
) -> WorkflowFacade:
    return WorkflowFacade(session)


def get_agent_facade(
    session: Session = Depends(get_session)
) -> AgentFacade:
    return AgentFacade(session)


def get_tool_facade(
    session: Session = Depends(get_session)
) -> ToolFacade:
    return ToolFacade(session)


def get_edge_service(
    session: Session = Depends(get_session)
) -> EdgeService:
    repo = EdgeRepository(session)
    return EdgeService(repo)


def get_position_service(
    session: Session = Depends(get_session)
) -> PositionService:
    repo = PositionRepository(session)
    return PositionService(repo)


def get_tool_service(
    session: Session = Depends(get_session)
) -> ToolService:
    repo = ToolRepository(session)
    return ToolService(repo)
