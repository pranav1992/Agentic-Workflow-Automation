from fastapi import APIRouter, Depends

from app.api.dependencies.services import get_edge_service
from app.application.services.edge_service import EdgeService
from app.domain.schema import EdgeCreate, EdgeResponse

router = APIRouter(
    prefix="/edges",
    tags=["edges"],
)


@router.post("/", response_model=EdgeResponse)
async def create_edge(
    edge: EdgeCreate, edge_service: EdgeService = Depends(get_edge_service)
):
    return edge_service.create(edge)


@router.get("/{workflow_id}", response_model=list[EdgeResponse])
async def get_edges(
    workflow_id, edge_service: EdgeService = Depends(get_edge_service)
):
    return edge_service.get_all(workflow_id)


@router.delete("/{edge_id}")
async def delete_edge(
    edge_id, edge_service: EdgeService = Depends(get_edge_service)
):
    return edge_service.delete(edge_id)


@router.put("/", response_model=EdgeResponse)
async def update_edge(
    edge: EdgeCreate, edge_service: EdgeService = Depends(get_edge_service)
):
    return edge_service.update(edge)
