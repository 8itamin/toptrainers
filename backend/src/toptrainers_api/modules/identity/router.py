from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.auth import (
    create_token,
    current_account,
    hash_password,
    password_is_strong,
    verify_password,
)
from toptrainers_api.core.config import settings
from toptrainers_api.core.db import get_session
from toptrainers_api.core.redis import get_redis
from toptrainers_api.modules.identity.models import Account, AuthSession, AuthToken
from toptrainers_api.modules.identity.schemas import RegisterAccountRequest, UserRole
from toptrainers_api.modules.identity.service import (
    RESET_PASSWORD,
    VERIFY_EMAIL,
    enforce_rate_limit,
    hash_secret,
    issue_one_time_token,
    revoke_account_sessions,
    send_password_reset_email,
    send_verification_email,
    utcnow,
)

router = APIRouter(prefix="/auth", tags=["identity"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class TokenRequest(BaseModel):
    token: str = Field(min_length=32, max_length=512)


class EmailRequest(BaseModel):
    email: EmailStr


class PasswordResetRequest(TokenRequest):
    password: str = Field(min_length=12, max_length=256)

    def is_password_strong(self) -> bool:
        return password_is_strong(self.password)


class AuthResponse(BaseModel):
    account_id: str
    role: UserRole


class MessageResponse(BaseModel):
    message: str


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        max_age=settings.auth_session_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        path="/api/v1",
    )


async def _send_verification(session: AsyncSession, account: Account) -> None:
    token = await issue_one_time_token(session, account.id, VERIFY_EMAIL, timedelta(hours=24))
    await session.commit()
    await send_verification_email(account.email, token)


@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED)
async def register(
    payload: RegisterAccountRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
    redis: Redis = Depends(get_redis),
) -> MessageResponse:
    email = str(payload.email).lower()
    await enforce_rate_limit(redis, request, "register", email, limit=5, window=3600)
    account = await session.scalar(select(Account).where(Account.email == email))
    if account and account.email_verified_at is not None:
        return MessageResponse(
            message="If this email can be registered, a verification message has been sent."
        )
    if account is None:
        account = Account(
            id=str(uuid4()),
            email=email,
            password_hash=hash_password(payload.password),
            role=payload.role.value,
        )
        session.add(account)
        await session.flush()
    await _send_verification(session, account)
    return MessageResponse(
        message="If this email can be registered, a verification message has been sent."
    )


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(
    payload: TokenRequest, session: AsyncSession = Depends(get_session)
) -> MessageResponse:
    token = await session.scalar(
        select(AuthToken).where(
            AuthToken.token_hash == hash_secret(payload.token),
            AuthToken.purpose == VERIFY_EMAIL,
            AuthToken.used_at.is_(None),
            AuthToken.expires_at > utcnow(),
        )
    )
    if token is None:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link")
    account = await session.get(Account, token.account_id)
    if account is None:
        raise HTTPException(status_code=400, detail="Invalid verification link")
    token.used_at = utcnow()
    account.email_verified_at = utcnow()
    await session.commit()
    return MessageResponse(message="Email verified. You can now sign in.")


@router.post("/login", response_model=AuthResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
    redis: Redis = Depends(get_redis),
) -> AuthResponse:
    email = str(payload.email).lower()
    await enforce_rate_limit(redis, request, "login", email, limit=10, window=900)
    account = await session.scalar(select(Account).where(Account.email == email))
    if not account or not verify_password(payload.password, account.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if account.email_verified_at is None:
        raise HTTPException(status_code=403, detail="Email verification required")
    auth_session = AuthSession(
        id=str(uuid4()),
        account_id=account.id,
        expires_at=utcnow() + timedelta(days=settings.auth_session_days),
    )
    session.add(auth_session)
    await session.commit()
    _set_session_cookie(response, create_token(account.id, account.role, auth_session.id))
    return AuthResponse(account_id=account.id, role=UserRole(account.role))


@router.post(
    "/password-reset/request",
    response_model=MessageResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def request_password_reset(
    payload: EmailRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
    redis: Redis = Depends(get_redis),
) -> MessageResponse:
    email = str(payload.email).lower()
    await enforce_rate_limit(redis, request, "password-reset", email, limit=5, window=3600)
    account = await session.scalar(select(Account).where(Account.email == email))
    if account and account.email_verified_at is not None:
        token = await issue_one_time_token(
            session, account.id, RESET_PASSWORD, timedelta(minutes=30)
        )
        await session.commit()
        await send_password_reset_email(account.email, token)
    return MessageResponse(
        message="If this account exists, a password reset message has been sent."
    )


@router.post("/password-reset/confirm", response_model=MessageResponse)
async def confirm_password_reset(
    payload: PasswordResetRequest, session: AsyncSession = Depends(get_session)
) -> MessageResponse:
    if not payload.is_password_strong():
        raise HTTPException(status_code=422, detail="Password does not meet security requirements")
    token = await session.scalar(
        select(AuthToken).where(
            AuthToken.token_hash == hash_secret(payload.token),
            AuthToken.purpose == RESET_PASSWORD,
            AuthToken.used_at.is_(None),
            AuthToken.expires_at > utcnow(),
        )
    )
    if token is None:
        raise HTTPException(status_code=400, detail="Invalid or expired password reset link")
    account = await session.get(Account, token.account_id)
    if account is None:
        raise HTTPException(status_code=400, detail="Invalid password reset link")
    account.password_hash = hash_password(payload.password)
    token.used_at = utcnow()
    await revoke_account_sessions(session, account.id)
    await session.commit()
    return MessageResponse(message="Password updated. Sign in with your new password.")


@router.get("/session", response_model=AuthResponse)
async def session_info(account: dict[str, object] = Depends(current_account)) -> AuthResponse:
    return AuthResponse(account_id=str(account["sub"]), role=UserRole(str(account["role"])))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> Response:
    session_id = str(account["sid"])
    auth_session = await session.get(AuthSession, session_id)
    if auth_session:
        auth_session.revoked_at = utcnow()
        await session.commit()
    response.delete_cookie(settings.auth_cookie_name, path="/api/v1")
    return response
