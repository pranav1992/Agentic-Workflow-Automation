from app.infrastructure.repository.position_repository import \
                                                PositionRepository
from app.infrastructure.db.models import PositionNode
from app.domain.schema import PositionCreate, PositionUpdate
from typing import List


class PositionService:
    def __init__(self, position_repository: PositionRepository):
        self.position_repository = position_repository

    def create(self, position: PositionCreate):
        return self.position_repository.create(
            PositionNode(**position.model_dump()))

    def update(self, position: PositionUpdate):
        return self.position_repository.update(position)

    def update_bulk(self, positions: List[PositionUpdate]):
        return self.position_repository.update_bulk(positions)

    def delete(self, position_id):
        return self.position_repository.delete(position_id)
