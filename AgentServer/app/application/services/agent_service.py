from app.infrastructure.repository.agent_repository import AgentRepository
from app.infrastructure.db.models import Agent
from app.domain.schema import AgentCreate
from app.domain.exceptions import (
                                InvalidAgentDataError,
                                AgentAlreadyInitializedError)


class AgentService:
    def __init__(self, agent_repository: AgentRepository):
        self.agent_repository = agent_repository

    def create(self, agent: AgentCreate):
        try:
            agent = Agent(**agent.model_dump())
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

    def initialize(self, agent):
        try:
            agent = Agent(**agent.model_dump())
        except Exception:
            raise InvalidAgentDataError()
        return self.agent_repository.initialize(agent)

    def get_all_agents(self):
        return self.agent_repository.get_all_agents()

    def get_agent(self, agent_id):
        return self.agent_repository.get_agent(agent_id)
