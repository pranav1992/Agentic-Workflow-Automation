from app.infrastructure.db.models import Edge
from app.domain.exceptions.edge import EdgeNotFoundError


class EdgeRepository:
    def __init__(self, session):
        self.session = session

    def create(self, edge):
        self.session.add(edge)
        self.session.commit()
        self.session.refresh(edge)
        return edge

    def get(self, edge_id):
        return self.session.get(Edge, edge_id)

    def delete(self, edge_id):
        edge = self.session.get(Edge, edge_id)
        if edge is None:
            raise EdgeNotFoundError(edge_id)
        self.session.delete(edge)
        self.session.commit()
        return edge

    def update(self, edge):
        self.session.merge(edge)
        self.session.commit()
        self.session.refresh(edge)
        return edge

    def get_all(self, workflow_id):
        return (
            self.session.query(Edge)
            .filter(Edge.workflow_id == workflow_id)
            .all()
        )

    def get_all_edges_by_workflow(self, workflow_id):
        return self.session.query(Edge).filter(
            Edge.workflow_id == workflow_id).all()
