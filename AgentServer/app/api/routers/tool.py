from fastapi import APIRouter, Depends
from app.application.facade.tool_facade import ToolFacade
from app.application.services.tool_service import ToolService
from app.api.dependencies.services import get_tool_facade, get_tool_service
from app.domain.schema import ToolPayload, ToolWithPositionResponse


router = APIRouter(prefix="/tools", tags=["tools"],)


@router.get("/{workflow_id}")
async def get_all_tools(
    workflow_id,
    tool_service: ToolService = Depends(get_tool_service),
):
    return tool_service.get_all_tools(workflow_id)


@router.get("/agent/{agent_id}")
async def get_all_tools_by_agent(
    agent_id,
    tool_service: ToolService = Depends(get_tool_service),
):
    return tool_service.get_all_tools_by_agent(agent_id)


@router.post("/", response_model=ToolWithPositionResponse)
async def create_tool(tool_data: ToolPayload, tool_facade:
                      ToolFacade = Depends(get_tool_facade)):
    return tool_facade.create_tool(tool_data)


@router.put("/")
async def update_tool(
    tool: ToolPayload,
    tool_facade: ToolFacade = Depends(get_tool_facade),
):
    return tool_facade.update_tool(tool)


@router.delete("/{tool_id}")
async def delete_tool(tool_id, tool_facade: ToolFacade = Depends(
                                                        get_tool_facade)):
    return tool_facade.delete_tool(tool_id)
