from sqlmodel import Session
from app.infrastructure.repository.tool_repository import ToolRepository
from app.application.services.tool_service import ToolService
from app.application.services.node_config_service import NodeConfigService
from app.infrastructure.repository.node_config_repository import \
    NodeConfigRepository
from app.application.services.position_service import PositionService
from app.infrastructure.repository.position_repository import \
    PositionRepository
from app.domain.schema import ToolPayload
from app.domain.schema import PositionCreate
from app.infrastructure.db.models import Tool


class ToolFacade:
    def __init__(self, session: Session):
        self.tool_service = ToolService(ToolRepository(session))
        self.position_service = PositionService(PositionRepository(session))
        self.config_service = NodeConfigService(NodeConfigRepository(session))
        self.session = session

    def create_tool(self, tool_data: ToolPayload):
        # persist Tool row
        tool = self.tool_service.create(Tool(**tool_data.tool.model_dump()))

        config = tool_data.tool_config
        config.tool_id = tool.id  # ensure constraint satisfied
        config.workflow_id = tool.workflow_id
        node_config = self.config_service.create(config)

        tool.config = node_config.id

        position_payload = PositionCreate(
            workflow_id=tool.workflow_id,
            x=0.0,
            y=0.0,
            tool_id=tool.id,
        )
        position = self.position_service.create(position_payload)
        tool.position = position.id

        self.session.commit()
        return tool

    def get_all_tools(self, workflow_id):
        return self.tool_service.get_all_tools(workflow_id)

    def get_all_tools_by_agent(self, agent_id):
        return self.tool_service.get_all_tools_by_agent(agent_id)

    def update_tool(self, tool):
        return self.tool_service.update(tool)

    def delete_tool(self, tool_id):
        return self.tool_service.delete(tool_id)
