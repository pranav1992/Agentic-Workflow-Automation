from .base import DomainError


class AccountLockedError(DomainError):
    """Raised when a user account is temporarily locked out after too
    many consecutive failed login attempts (see
    AuthService.authenticate_user_by_email and
    settings.ACCOUNT_LOCKOUT_THRESHOLD)."""

    code = "ACCOUNT_LOCKED"

    def __init__(self, retry_after_seconds: int):
        self.retry_after_seconds = max(retry_after_seconds, 0)
        super().__init__(
            "Too many failed login attempts. Try again in "
            f"{self.retry_after_seconds} seconds."
        )
