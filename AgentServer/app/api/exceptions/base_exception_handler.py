from .agent import agent_exception_handler
from .system import system_exception_handler
from .workflow import workflow_exception_handler
from .edge import edge_exception_handler
from .tool import tool_exception_handler


def base_exception_handler(app):
    """Register all API-level exception handlers on the FastAPI app."""

    agent_exception_handler(app)
    workflow_exception_handler(app)
    system_exception_handler(app)
    edge_exception_handler(app)
    tool_exception_handler(app)

    return app
