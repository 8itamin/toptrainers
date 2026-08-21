from __future__ import annotations

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from toptrainers_api.modules.clients import service
from toptrainers_api.modules.clients.models import (
    InvitationStatus,
    RelationshipStatus,
    TrainerClientInvitation,
    TrainerClientRelationship,
)
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
                password_hash="not-used-in-domain-tests",
                role=role,
            )
        )
        await session.commit()


async def test_invitation_accept_terminate_and_new_cooperation_create_new_history(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await _account(p0_session_factory, "trainer-1", "trainer")
    await _account(p0_session_factory, "client-1", "client")

    async with p0_session_factory() as session:
        first_invitation = await service.create_invitation(session, "trainer-1", "client-1")
        first_relationship = await service.accept_invitation(
            session, "client-1", first_invitation.id
        )
        await service.terminate_relationship(session, "trainer-1", first_relationship.id)
        second_invitation = await service.create_invitation(session, "trainer-1", "client-1")
        second_relationship = await service.accept_invitation(
            session, "client-1", second_invitation.id
        )

        assert first_invitation.status == InvitationStatus.ACCEPTED.value
        assert first_relationship.status == RelationshipStatus.TERMINATED.value
        assert second_invitation.id != first_invitation.id
        assert second_relationship.id != first_relationship.id
        assert second_relationship.status == RelationshipStatus.ACTIVE.value
        assert await service.has_client_p0_footprint(session, "client-1") is True

        invitation_count = await session.scalar(
            select(func.count()).select_from(TrainerClientInvitation)
        )
        relationship_count = await session.scalar(
            select(func.count()).select_from(TrainerClientRelationship)
        )
        assert invitation_count == 2
        assert relationship_count == 2
