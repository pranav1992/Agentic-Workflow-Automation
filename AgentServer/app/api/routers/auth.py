from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.domain.schema import LoginRequest, LoginResponse, RegisterRequest, UserResponse
from app.application.services.auth_service import AuthService
from app.api.dependencies.services import get_auth_service
from app.api.dependencies.auth import get_current_user
from app.core.constants import UserRole

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


@router.post("/login", response_model=LoginResponse)
def login(
    credentials: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    user = auth_service.authenticate_user_by_email(
        credentials.email, credentials.password
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = auth_service.create_access_token(
        user_id=user.id,
        tenant_id=user.tenant_id,
        role=UserRole(user.role),
        token_version=user.token_version,
    )
    return LoginResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.post("/register", response_model=LoginResponse)
def register(
    payload: RegisterRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Self-registration: always creates a brand-new tenant with this
    user as its first admin (there's no "join an existing org" flow),
    seeded with the demo workflow — see AuthService.register_new_tenant.
    Signs the user in immediately, same response shape as /auth/login.
    """
    user, _tenant = auth_service.register_new_tenant(
        tenant_name=payload.tenant_name,
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
    )

    token = auth_service.create_access_token(
        user_id=user.id,
        tenant_id=user.tenant_id,
        role=UserRole(user.role),
        token_version=user.token_version,
    )
    return LoginResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.post("/logout", status_code=204)
def logout(
    payload: dict = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
):
    """Invalidates every token issued to this user, not just the one used
    to call this endpoint — there's no per-device session tracking to
    revoke just one, so this is "sign out everywhere.\""""
    user = auth_service.get_user(UUID(payload["sub"]))
    if user:
        auth_service.revoke_all_tokens(user)


@router.get("/me", response_model=UserResponse)
def me(
    payload: dict = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
):
    """Round-trips the bearer token through real verification (signature +
    expiry) and confirms the user it names still exists, so the frontend can
    tell an expired/forged/stale token from one that's actually still good.
    """
    user = auth_service.get_user(UUID(payload["sub"]))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists.",
        )
    return UserResponse.model_validate(user)
