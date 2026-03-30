from app.infrastructure.repository.agent_repository import AgentRepository
from app.infrastructure.db.models import Agent
from app.domain.schema import InititialAgent, AgentCreate
from app.domain.exceptions import (
                                InvalidAgentDataError,
                                AgentAlreadyInitializedError,
                                AgentNameAlreadyExist)


class AgentService:
    def __init__(self, agent_repository: AgentRepository):
        self.agent_repository = agent_repository

    def create(self, agent: AgentCreate):
        try:
            agent = Agent(**agent.model_dump())
            exist = self.agent_repository.isNameAlreadyExist(
                agent.name, agent.workflow_id
            )
            if exist:
                raise AgentNameAlreadyExist(agent.name)
        except Exception:
            raise InvalidAgentDataError()
        return self.agent_repository.create(agent)

    def update(self, agent):
        try:
            agent = Agent(**agent.model_dump())
        except Exception:
            raise InvalidAgentDataError()
        return self.agent_repository.update(agent)

    def delete(self, agent_id):

        return self.agent_repository.delete(agent_id)

    def initialize(self, workflow_id, position_id):
        try:
            payload = InititialAgent(
                name="Start agent",
                workflow_id=workflow_id,
                position=position_id,
                isInitial=True,
            )
            agent = Agent(**payload.model_dump())
            if not agent.isInitial:
                raise InvalidAgentDataError()
            already_exist = self.agent_repository.isInitialized(
                agent.workflow_id)
            if already_exist:
                raise AgentAlreadyInitializedError()
        except Exception:
            raise InvalidAgentDataError()
        return self.agent_repository.initialize(agent)

    def get_all_agents(self, workflow_id):
        return self.agent_repository.get_all_agents(workflow_id)

    def get_agent(self, agent_id):
        return self.agent_repository.get_agent(agent_id)
