from uuid import UUID

from fastapi import APIRouter, Depends
from app.domain.schema import (
    WorkflowCreate,
    WorkflowResponse,
    AgentWithPositionResponse,
    CombinedNodesResponse,
    WorkflowLaunchResponse,
    WorkflowSessionResponse,
    WorkflowStatusResponse,
)
from app.application.services.workflow_service import WorkflowService
from app.application.facade.workflow_facade import WorkflowFacade
from app.application.services.session_service import SessionService
from app.api.dependencies.services import (
    get_workflow_service,
    get_workflow_facade,
    get_session_service,
)


router = APIRouter(
    prefix="/workflows",
    tags=["workflows"],
)


@router.post("/", response_model=WorkflowResponse)
def create_workflow(workflow: WorkflowCreate, workflowFacade:
                    WorkflowFacade = Depends(get_workflow_facade)):
    return workflowFacade.create_workflow_with_initial_agent(workflow)


@router.get("/get_all", response_model=list[WorkflowResponse])
def get_all_workflows(workflow_service: WorkflowService = Depends(
                                                get_workflow_service)):
    return workflow_service.get_all_workflows()


@router.get("/get/{id}", response_model=WorkflowResponse)
def get_workflow(id, workflow_service: WorkflowService = Depends(
                                                    get_workflow_service)):
    return workflow_service.get_workflow(id)


@router.get("/get_by_name/{name}", response_model=WorkflowResponse)
def get_workflow_by_name(name, workflow_service: WorkflowService = Depends(
                                                    get_workflow_service)):
    return workflow_service.get_workflow_by_name(name)


@router.delete("/delete/{id}", response_model=WorkflowResponse)
def delete_workflow(id, workflow_facade: WorkflowFacade = Depends(
                                                    get_workflow_facade)):
    return workflow_facade.delete_workflow(id)


@router.put("/update/{id}", response_model=WorkflowResponse)
def update_workflow(id, workflow: WorkflowCreate,
                    workflow_service: WorkflowService = Depends(
                                                    get_workflow_service)):
    return workflow_service.update_workflow(id, workflow)


@router.get("/get_all_agent/{id}", response_model=list[
                                        AgentWithPositionResponse])
def get_all_agents(id, workflow_facade: WorkflowFacade = Depends(
                                                    get_workflow_facade)):
    return workflow_facade.get_all_agents(id)


@router.get(
    "/get_all_nodes/{id}",
    response_model=CombinedNodesResponse,
)
def get_all_nodes(
    id, workflow_facade: WorkflowFacade = Depends(get_workflow_facade)
):
    """
    Return both agents and tools (with positions/config) for a workflow.
    """
    return workflow_facade.get_all_nodes(id)


@router.post("/{id}/launch", response_model=WorkflowLaunchResponse)
async def launch_workflow(
    id: UUID,
    session_service: SessionService = Depends(get_session_service),
):
    return await session_service.launch(id)


@router.post("/{id}/stop", status_code=200)
async def stop_workflow(
    id: UUID,
    session_service: SessionService = Depends(get_session_service),
):
    await session_service.stop(id)
    return {"status": "stopped"}


@router.get("/{id}/status", response_model=WorkflowStatusResponse)
def workflow_status(
    id: UUID,
    session_service: SessionService = Depends(get_session_service),
):
    return session_service.get_status(id)


@router.get("/{id}/sessions", response_model=list[WorkflowSessionResponse])
def workflow_sessions(
    id: UUID,
    session_service: SessionService = Depends(get_session_service),
):
    return session_service.get_sessions(id)
