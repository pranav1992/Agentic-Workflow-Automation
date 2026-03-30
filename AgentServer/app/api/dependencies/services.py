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
