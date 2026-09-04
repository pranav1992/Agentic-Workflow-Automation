from app.infrastructure.repository.tool_repository import ToolRepository
from app.domain.exceptions import InvalidToolDataError


class ToolService:
    def __init__(self, tool_repository: ToolRepository):
        self.tool_repository = tool_repository

    def create(self, tool):
        return self.tool_repository.create(tool)

    def get_all_tools(self, workflow_id):
        return self.tool_repository.get_all_tools(workflow_id)

    def get_all_tools_by_agent(self, agent_id):
        return self.tool_repository.get_all_tools_by_agent(agent_id)

    def update(self, tool):
        if not getattr(tool, "id", None):
            raise InvalidToolDataError()
        return self.tool_repository.update(tool)

    def delete(self, tool_id):
        return self.tool_repository.delete(tool_id)

    def get(self, tool_id):
        return self.tool_repository.get(tool_id)
