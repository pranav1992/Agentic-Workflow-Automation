from fastapi import APIRouter
from app.application.services.agent_service import AgentService
from app.domain.schema import (
                    AgentPayload, AgentWithPositionResponse)
from fastapi import Depends
from app.application.facade.agent_facade import AgentFacade
from app.api.dependencies.services import get_agent_service, get_agent_facade


router = APIRouter(
    prefix="/agents",
    tags=["agents"],
)


@router.post("/", response_model=AgentWithPositionResponse)
def create_agent(agent: AgentPayload, agent_facade: AgentFacade = Depends(
                                                        get_agent_facade)):
    return agent_facade.create_agent(agent)


@router.put("/", response_model=AgentWithPositionResponse)
def update_agent(agent: AgentPayload, agent_facade: AgentFacade = Depends(
                                                    get_agent_facade)):
    return agent_facade.update_agent(agent)


@router.delete("/{id}", response_model=AgentWithPositionResponse)
def delete_agent(id, agent_service: AgentService = Depends(
                                                    get_agent_service)):
    return agent_service.delete(id)


@router.get("/{id}", response_model=AgentWithPositionResponse)
def getAgent(id, agent_service: AgentService = Depends(
                                                    get_agent_service)):
    return agent_service.get_agent(id)
