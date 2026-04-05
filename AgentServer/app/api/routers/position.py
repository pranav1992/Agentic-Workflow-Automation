from fastapi import APIRouter, Depends
from app.application.services.position_service import PositionService
from app.api.dependencies.services import get_position_service
from app.domain.schema import PositionUpdate
from typing import List
router = APIRouter(
    prefix="/positions",
    tags=["positions"],
)


@router.put("/")
async def update_position(
    position: PositionUpdate,
    position_service: PositionService = Depends(get_position_service),
):
    return position_service.update(position)


@router.put("/bulk")
async def update_positions_bulk(
    positions: List[PositionUpdate],
    position_service: PositionService = Depends(get_position_service),
):
    return position_service.update_bulk(positions)
