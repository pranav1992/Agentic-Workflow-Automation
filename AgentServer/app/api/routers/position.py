from fastapi import APIRouter, Depends
from app.application.services.position_service import PositionService
from app.api.dependencies.services import get_position_service
from app.api.dependencies.auth import require_admin
from app.domain.schema import PositionUpdate
from typing import List

# Every route here mutates canvas layout, so the guard sits on the router
# rather than being repeated per-route.
router = APIRouter(
    prefix="/positions",
    tags=["positions"],
    dependencies=[Depends(require_admin)],
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
