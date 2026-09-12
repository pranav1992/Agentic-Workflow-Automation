from fastapi import Request
from fastapi.responses import JSONResponse

from app.domain.exceptions import AccountLockedError


def auth_exception_handler(app):

    @app.exception_handler(AccountLockedError)
    async def account_locked_handler(request: Request, exc: AccountLockedError):
        return JSONResponse(
            status_code=423,
            content={"detail": exc.message},
            headers={"Retry-After": str(exc.retry_after_seconds)},
        )
