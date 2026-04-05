from .base import DomainError


class InvalidToolDataError(DomainError):
    code = "INVALID_TOOL_DATA"

    def __init__(self, message: str = "Invalid tool data"):
        super().__init__(message)


class ToolNameAlreadyExist(DomainError):
    code = "TOOL_NAME_EXISTS"

    def __init__(self, name: str):
        self.name = name
        super().__init__(f"Tool name {name} already exists")


class ToolNotFoundError(DomainError):
    code = "TOOL_NOT_FOUND"

    def __init__(self, tool_id):
        self.tool_id = tool_id
        super().__init__(f"Tool {tool_id} not found")
