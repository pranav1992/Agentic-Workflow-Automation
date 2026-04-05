from fastapi import Request
from fastapi.responses import JSONResponse

from app.domain.exceptions import (
    InvalidEdgeDataError,
    EdgeNotFoundError,
)


def edge_exception_handler(app):
    @app.exception_handler(InvalidEdgeDataError)
    async def invalid_edge_handler(
        request: Request, exc: InvalidEdgeDataError
    ):
        return JSONResponse(status_code=400, content={"detail": exc.message})

    @app.exception_handler(EdgeNotFoundError)
    async def edge_not_found_handler(
        request: Request, exc: EdgeNotFoundError
    ):
        return JSONResponse(
            status_code=404,
            content={"detail": exc.message, "edge_id": getattr(exc, "edge_id", None)},
        )
