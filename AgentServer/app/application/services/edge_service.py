from app.infrastructure.repository.edge import EdgeRepository
from app.infrastructure.db.models import Edge
from app.domain.schema import EdgeCreate
from app.domain.exceptions.edge import InvalidEdgeDataError


class EdgeService:
    def __init__(self, edge_repository: EdgeRepository):
        self.edge_repository = edge_repository

    def create(self, edge_data: EdgeCreate):
        try:
            edge = Edge(**edge_data.model_dump(exclude_none=True))
        except Exception:
            raise InvalidEdgeDataError()
        return self.edge_repository.create(edge)

    def delete(self, edge_id):
        return self.edge_repository.delete(edge_id)

    def get_all(self, workflow_id):
        # prefer new get_all; fall back if older method exists
        if hasattr(self.edge_repository, "get_all"):
            return self.edge_repository.get_all(workflow_id)
        return self.edge_repository.get_all_edges_by_workflow(workflow_id)

    def get(self, edge_id):
        return self.edge_repository.get(edge_id)

    def update(self, edge):
        # edge arrives as EdgeCreate schema
        try:
            edge_model = Edge(**edge.model_dump(exclude_none=True))
        except Exception:
            raise InvalidEdgeDataError()
        return self.edge_repository.update(edge_model)
