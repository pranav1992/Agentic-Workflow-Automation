import secrets
from typing import Optional

from fastapi import Header, HTTPException, status

from app.core.settings import get_settings


def require_admin(x_admin_token: Optional[str] = Header(default=None)) -> None:
    """Guards mutating endpoints with a shared secret.

    Reads and the voice-demo launch stay public on purpose — the demo is meant
    for anonymous visitors — but nobody anonymous should be able to rewrite or
    delete workflows, or read back tool configs that may carry credentials.

    Fails closed: if ADMIN_API_TOKEN isn't configured, every mutation is
    refused rather than silently left open, so a missing env var can't
    reintroduce the hole this exists to close.
    """
    settings = get_settings()
    expected = settings.ADMIN_API_TOKEN

    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ADMIN_API_TOKEN is not configured; mutations are disabled.",
        )

    if not x_admin_token or not secrets.compare_digest(x_admin_token, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid X-Admin-Token.",
        )
