from typing import Optional

from fastapi import Header, HTTPException, status

from app.core.security import get_jwt_manager


def _decode_bearer_token(authorization: Optional[str]) -> Optional[dict]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    return get_jwt_manager().decode_token(token)


def get_current_user(authorization: Optional[str] = Header(default=None)) -> dict:
    """Resolve the signed-in user from a `Authorization: Bearer <jwt>` header.

    This is the only gate on every route: any signed-in user, regardless of
    role, can read and write everything. There's no admin/operator
    distinction — role is unused for authorization.
    """
    payload = _decode_bearer_token(authorization)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid bearer token.",
        )
    return payload
