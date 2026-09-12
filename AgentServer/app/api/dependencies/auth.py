from typing import Optional
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from sqlmodel import Session

from app.core.security import get_jwt_manager
from app.infrastructure.db.session import get_session
from app.infrastructure.db.auth_models import User


def _decode_bearer_token(authorization: Optional[str]) -> Optional[dict]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    return get_jwt_manager().decode_token(token)


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    session: Session = Depends(get_session),
) -> dict:
    """Resolve the signed-in user from a `Authorization: Bearer <jwt>` header.

    This is the only gate on every route: any signed-in user, regardless of
    role, can read and write everything. There's no admin/operator
    distinction — role is unused for authorization.

    Also checks the token's "tv" (token_version) claim against the
    current User row: logout bumps that column, which invalidates every
    token issued before the bump immediately, even ones that haven't
    expired yet. Without this check, revocation would only be enforced by
    waiting out the token's natural expiry.
    """
    payload = _decode_bearer_token(authorization)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid bearer token.",
        )

    try:
        user_id = UUID(payload.get("sub", ""))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed bearer token.",
        )

    user = session.get(User, user_id)
    if user is None or user.token_version != payload.get("tv"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please sign in again.",
        )

    return payload
