from fastapi import APIRouter
from app.application.services.agent_service import AgentService
from app.domain.schema import AgentCreate, InititialAgent
from app.infrastructure.repository.agent_repository import AgentRepository
from app.infrastructure.db.session import get_session
from fastapi import Depends
from sqlmodel import Session
from app.domain.schema import Agentresponse


router = APIRouter(
    prefix="/agents",
    tags=["agents"],
)


@router.post("/create_agent", response_model=Agentresponse)
def create_agent(agent: AgentCreate, session: Session = Depends(get_session)):
    agent_service = AgentService(AgentRepository(session))
    return agent_service.create(agent)


@router.post("/initialize_agent", response_model=Agentresponse)
def initialize_agent(agent: InititialAgent, session:
                     Session = Depends(get_session)):
    agent_service = AgentService(AgentRepository(session))
    return agent_service.initialize(agent)


@router.put("/update_agent", response_model=Agentresponse)
def update_agent(agent, session: Session = Depends(get_session)):
    agent_service = AgentService(AgentRepository(session))
    return agent_service.update(agent)


@router.delete("/delete_agent", response_model=Agentresponse)
def delete_agent(agent, session: Session = Depends(get_session)):
    agent_service = AgentService(AgentRepository(session))
    return agent_service.delete(agent)
