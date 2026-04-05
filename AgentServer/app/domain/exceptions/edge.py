from .base import DomainError


class InvalidEdgeDataError(DomainError):
    code = "INVALID_EDGE_DATA"

    def __init__(self, message: str = "Invalid edge data"):
        super().__init__(message)


class EdgeNotFoundError(DomainError):
    code = "EDGE_NOT_FOUND"

    def __init__(self, edge_id):
        self.edge_id = edge_id
        super().__init__(f"Edge {edge_id} not found")
