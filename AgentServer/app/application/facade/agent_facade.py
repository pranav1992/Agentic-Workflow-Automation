from sqlmodel import Session
from app.application.services.position_service import PositionService
from app.application.services.node_config_service import NodeConfigService
from app.application.services.agent_service import AgentService
from app.infrastructure.repository.position_repository import \
                                                    PositionRepository
from app.infrastructure.repository.node_config_repository import \
                                                    NodeConfigRepository
from app.infrastructure.repository.agent_repository import AgentRepository
from app.domain.schema import (
    AgentPayload,
    InititialAgent,
    NodeConfigCreate,
    PositionCreate,
)


class AgentFacade:  
    def __init__(self, session: Session):
        self.agent_service = AgentService(AgentRepository(session))
        self.position_service = PositionService(PositionRepository(session))
        self.node_config_service = NodeConfigService(
                                        NodeConfigRepository(session))
        self.session = session

    def create_agent(self, agent_data: AgentPayload):
        agent = self.agent_service.create(agent_data.agent)

        config = agent_data.config
        config.agent_id = agent.id  # ensure constraint satisfied
        config.workflow_id = agent.workflow_id
        node_config = self.node_config_service.create(config)
        agent.config = node_config.id

        position_payload = PositionCreate(
            workflow_id=agent.workflow_id,
            x=0.0,
            y=0.0,
            agent_id=agent.id,
        )
        position = self.position_service.create(position_payload)
        agent.position = position.id

        self.session.commit()
        return agent

    def update_agent(self, agent_data: AgentPayload):
        agent = self.agent_service.update(agent_data.agent)

        config = agent_data.config
        self.node_config_service.update(config)

        return self.agent_service.update(agent)

    def get_agent(self, agent_id):
        return self.agent_service.get_agent(agent_id)

    def initialize_agent(self, agent_data: InititialAgent):
        agent = self.agent_service.create(agent_data)

        config = NodeConfigCreate(
            type="agent",
            workflow_id=agent_data.workflow_id,
            metadata={},
            agent_id=agent.id,
        )

        node_config = self.node_config_service.create(config)
        agent.config = node_config.id

        position_payload = PositionCreate(
            workflow_id=agent.workflow_id,
            x=0.0,
            y=0.0,
            agent_id=agent.id,
        )
        position = self.position_service.create(position_payload)
        agent.position = position.id

        self.session.commit()
        return agent
