from app.infrastructure.db.models import PositionNode


class PositionRepository:
    def __init__(self, session):
        self.session = session

    def create(self, position):
        self.session.add(position)
        self.session.flush()
        return position

    def update(self, position):
        self.session.merge(PositionNode(**position.model_dump()))
        self.session.commit()
        return position

    def update_bulk(self, positions):
        # simple looped merge keeps it database-agnostic
        for pos in positions:
            self.session.merge(PositionNode(**pos.model_dump()))
        self.session.commit()
        return positions

    def delete(self, position_id):
        position = self.session.get(PositionNode, position_id)
        self.session.delete(position)
        self.session.commit()
        self.session.refresh(position)
        return position
