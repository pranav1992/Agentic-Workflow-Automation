from app.infrastructure.db.models import PositionNode


class PositionRepository:
    def __init__(self, session):
        self.session = session

    def create(self, position):
        self.session.add(position)
        self.session.flush()
        return position

    def update(self, position, tenant_id):
        existing = self.session.get(PositionNode, position.id)
        if existing is None or existing.tenant_id != tenant_id:
            return None
        # merge() overwrites every column from the incoming transient
        # object, including tenant_id — position.model_dump() never
        # carries it (clients don't send it), so pass the verified value
        # explicitly or the merge would null it out.
        self.session.merge(
            PositionNode(**position.model_dump(), tenant_id=tenant_id)
        )
        self.session.commit()
        return position

    def update_bulk(self, positions, tenant_id):
        updated = []
        for pos in positions:
            existing = self.session.get(PositionNode, pos.id)
            if existing is None or existing.tenant_id != tenant_id:
                continue
            self.session.merge(
                PositionNode(**pos.model_dump(), tenant_id=tenant_id)
            )
            updated.append(pos)
        self.session.commit()
        return updated

    def delete(self, position_id, tenant_id):
        position = self.session.get(PositionNode, position_id)
        if position is None or position.tenant_id != tenant_id:
            return None
        self.session.delete(position)
        self.session.commit()
        self.session.refresh(position)
        return position
