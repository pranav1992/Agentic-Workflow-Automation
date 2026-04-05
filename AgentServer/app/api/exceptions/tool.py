from fastapi import Request
from fastapi.responses import JSONResponse

from app.domain.exceptions import (

    ToolNameAlreadyExist,
    ToolNotFoundError,
    InvalidToolDataError
)


def tool_exception_handler(app):
    @app.exception_handler(InvalidToolDataError)
    async def invalid_tool_data_handler(
            request: Request, exc: InvalidToolDataError):
        return JSONResponse(
            status_code=400,
            content={"detail": exc.message},
        )

    @app.exception_handler(ToolNameAlreadyExist)
    async def tool_name_exists_handler(
            request: Request, exc: ToolNameAlreadyExist):
        return JSONResponse(
            status_code=400,
            content={"detail": exc.message, "name": getattr(
                                            exc, "name", None)},
        )

    @app.exception_handler(ToolNotFoundError)
    async def tool_not_found_handler(request: Request, exc: ToolNotFoundError):
        return JSONResponse(
            status_code=404,
            content={"detail": exc.message, "tool_id": getattr(
                                            exc, "tool_id", None)},
        )
