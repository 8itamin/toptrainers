from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from toptrainers_api.core.auth import create_token
from toptrainers_api.core.config import settings
from toptrainers_api.core.db import get_session
from toptrainers_api.modules.identity.models import Account, AuthSession
from toptrainers_api.modules.identity.router import router

pytestmark = pytest.mark.asyncio


async def _seed_session(
    factory: async_sessionmaker[AsyncSession],
) -> tuple[str, str]:
    account_id = "logout-account"
    session_id = "logout-session"
    async with factory() as session:
        session.add(
            Account(
                id=account_id,
                email="logout@example.test",
                password_hash="not-used-in-logout-test",
                role="client",
                email_verified_at=datetime.now(UTC),
            )
        )
        session.add(
            AuthSession(
                id=session_id,
                account_id=account_id,
                expires_at=datetime.now(UTC) + timedelta(days=1),
            )
        )
        await session.commit()
    token = create_token(account_id, "client", session_id)
    return session_id, token


@asynccontextmanager
async def _http_client(
    factory: async_sessionmaker[AsyncSession],
) -> AsyncIterator[AsyncClient]:
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


async def test_logout_returns_204_revokes_session_and_deletes_cookie(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    session_id, token = await _seed_session(p0_session_factory)

    async with _http_client(p0_session_factory) as client:
        client.cookies.set(settings.auth_cookie_name, token, path="/api/v1")
        response = await client.post("/api/v1/auth/logout")

        assert response.status_code == 204
        assert response.content == b""
        set_cookie = response.headers.get("set-cookie", "")
        assert f"{settings.auth_cookie_name}=" in set_cookie
        assert "Max-Age=0" in set_cookie
        assert "Path=/api/v1" in set_cookie

        stale_session = await client.get(
            "/api/v1/auth/session",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert stale_session.status_code == 401

    async with p0_session_factory() as session:
        auth_session = await session.get(AuthSession, session_id)
        assert auth_session is not None
        assert auth_session.revoked_at is not None
