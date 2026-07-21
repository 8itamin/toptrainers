from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.auth import create_token, hash_password, verify_password
from toptrainers_api.core.db import get_session
from toptrainers_api.modules.identity.models import Account
from toptrainers_api.modules.identity.schemas import RegisterAccountRequest, UserRole
from pydantic import BaseModel, EmailStr, Field

router = APIRouter(prefix="/auth", tags=["identity"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    account_id: str
    role: UserRole


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(payload: RegisterAccountRequest, session: AsyncSession = Depends(get_session)) -> AuthResponse:
    existing = await session.scalar(select(Account).where(Account.email == str(payload.email).lower()))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    account = Account(id=str(uuid4()), email=str(payload.email).lower(), password_hash=hash_password(payload.password), role=payload.role.value)
    session.add(account)
    await session.commit()
    return AuthResponse(access_token=create_token(account.id, account.role), account_id=account.id, role=UserRole(account.role))


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_session)) -> AuthResponse:
    account = await session.scalar(select(Account).where(Account.email == str(payload.email).lower()))
    if not account or not verify_password(payload.password, account.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return AuthResponse(access_token=create_token(account.id, account.role), account_id=account.id, role=UserRole(account.role))
