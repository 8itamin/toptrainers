from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from toptrainers_api.core.auth import current_account
from toptrainers_api.core.db import get_session
from toptrainers_api.modules.clients import service
from toptrainers_api.modules.clients.router import router
from toptrainers_api.modules.identity.models import Account

pytestmark = pytest.mark.asyncio


async def _account(
    factory: async_sessionmaker[AsyncSession], account_id: str, role: str
) -> None:
    async with factory() as session:
        session.add(
            Account(
                id=account_id,
                email=f"{account_id}@example.test",
                password_hash="not-used-in-http-tests",
                role=role,
            )
        )
        await session.commit()


@asynccontextmanager
async def _http_client(
    factory: async_sessionmaker[AsyncSession], actor_id: str, role: str
) -> AsyncIterator[AsyncClient]:
    app = FastAPI()
    app.include_router(router)

    async def override_current_account() -> dict[str, object]:
        return {"sub": actor_id, "role": role, "sid": "test-session"}

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session

    app.dependency_overrides[current_account] = override_current_account
    app.dependency_overrides[get_session] = override_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.mark.parametrize(
    ("role", "path", "payload"),
    [
        ("client", "/clients/invitations", {"client_id": "target"}),
        ("trainer", "/clients/invitations/missing/accept", None),
        ("trainer", "/clients/invitations/missing/reject", None),
        ("client", "/clients/invitations/missing/cancel", None),
        ("admin", "/clients/relationships/missing/terminate", None),
    ],
)
async def test_http_role_boundaries_return_403_role_not_allowed(
    p0_session_factory: async_sessionmaker[AsyncSession],
    role: str,
    path: str,
    payload: dict[str, str] | None,
) -> None:
    async with _http_client(p0_session_factory, "actor", role) as client:
        response = await client.post(path, json=payload)

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "ROLE_NOT_ALLOWED"


async def test_unrelated_client_cannot_accept_invitation_over_http(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await _account(p0_session_factory, "trainer-1", "trainer")
    await _account(p0_session_factory, "client-1", "client")
    await _account(p0_session_factory, "client-2", "client")

    async with p0_session_factory() as session:
        invitation = await service.create_invitation(session, "trainer-1", "client-1")

    async with _http_client(p0_session_factory, "client-2", "client") as client:
        response = await client.post(f"/clients/invitations/{invitation.id}/accept")

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "INVITATION_CLIENT_REQUIRED"


async def test_missing_invitation_returns_404_business_error_over_http(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with _http_client(p0_session_factory, "client-1", "client") as client:
        response = await client.post("/clients/invitations/missing/accept")

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "INVITATION_NOT_FOUND"


async def test_duplicate_pending_invitation_returns_409_business_error_over_http(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await _account(p0_session_factory, "trainer-1", "trainer")
    await _account(p0_session_factory, "client-1", "client")

    async with _http_client(p0_session_factory, "trainer-1", "trainer") as client:
        first = await client.post("/clients/invitations", json={"client_id": "client-1"})
        second = await client.post("/clients/invitations", json={"client_id": "client-1"})

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["detail"]["code"] == "INVITATION_ALREADY_PENDING"
