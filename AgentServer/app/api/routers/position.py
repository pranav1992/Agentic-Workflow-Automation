from fastapi import APIRouter
from app.application.services.position_service import PositionService
from app.domain.schema import PositionUpdate
from typing import List
from app.infrastructure.repository.position_repository import \
                                             PositionRepository
from app.infrastructure.db.session import get_session
from sqlmodel import Session
from fastapi import Depends
router = APIRouter(
    prefix="/positions",
    tags=["positions"],
)


@router.put("/")
async def update_position(position: PositionUpdate,
                          session: Session = Depends(get_session)):
    repo = PositionRepository(session)
    position_service = PositionService(repo)

    return position_service.update(position)


@router.put("/bulk")
async def update_positions_bulk(positions: List[PositionUpdate],
                                session: Session = Depends(get_session)):
    repo = PositionRepository(session)
    position_service = PositionService(repo)

    return position_service.update_bulk(positions)
