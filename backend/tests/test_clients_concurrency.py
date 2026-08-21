from __future__ import annotations

import asyncio

import pytest
from fastapi import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from toptrainers_api.core.errors import BusinessRuleError
from toptrainers_api.modules.clients import service
from toptrainers_api.modules.clients.models import (
    InvitationStatus,
    RelationshipStatus,
    TrainerClientInvitation,
    TrainerClientRelationship,
)
from toptrainers_api.modules.identity.models import Account
from toptrainers_api.modules.identity.router import become_trainer

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


async def _run_in_session(
    factory: async_sessionmaker[AsyncSession],
    operation,
):
    async with factory() as session:
        return await operation(session)


async def test_double_invitation_creates_exactly_one_pending_row(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await _account(p0_session_factory, "trainer-1", "trainer")
    await _account(p0_session_factory, "client-1", "client")

    async def create(session: AsyncSession):
        return await service.create_invitation(session, "trainer-1", "client-1")

    results = await asyncio.gather(
        _run_in_session(p0_session_factory, create),
        _run_in_session(p0_session_factory, create),
        return_exceptions=True,
    )
    successes = [result for result in results if isinstance(result, TrainerClientInvitation)]
    conflicts = [result for result in results if isinstance(result, BusinessRuleError)]
    assert len(successes) == 1
    assert len(conflicts) == 1
    assert conflicts[0].code == "INVITATION_ALREADY_PENDING"

    async with p0_session_factory() as session:
        count = await session.scalar(
            select(func.count())
            .select_from(TrainerClientInvitation)
            .where(TrainerClientInvitation.status == InvitationStatus.PENDING.value)
        )
        assert count == 1


async def test_accept_vs_cancel_has_one_terminal_outcome(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await _account(p0_session_factory, "trainer-1", "trainer")
    await _account(p0_session_factory, "client-1", "client")
    async with p0_session_factory() as session:
        invitation = await service.create_invitation(session, "trainer-1", "client-1")
        invitation_id = invitation.id

    async def accept(session: AsyncSession):
        return await service.accept_invitation(session, "client-1", invitation_id)

    async def cancel(session: AsyncSession):
        return await service.cancel_invitation(session, "trainer-1", invitation_id)

    results = await asyncio.gather(
        _run_in_session(p0_session_factory, accept),
        _run_in_session(p0_session_factory, cancel),
        return_exceptions=True,
    )
    assert sum(not isinstance(result, Exception) for result in results) == 1
    assert sum(isinstance(result, BusinessRuleError) for result in results) == 1

    async with p0_session_factory() as session:
        persisted = await session.get(TrainerClientInvitation, invitation_id)
        assert persisted is not None
        assert persisted.status in {
            InvitationStatus.ACCEPTED.value,
            InvitationStatus.CANCELLED.value,
        }
        relationship_count = await session.scalar(
            select(func.count()).select_from(TrainerClientRelationship)
        )
        assert relationship_count == (
            1 if persisted.status == InvitationStatus.ACCEPTED.value else 0
        )


async def test_double_accept_returns_the_same_single_relationship(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await _account(p0_session_factory, "trainer-1", "trainer")
    await _account(p0_session_factory, "client-1", "client")
    async with p0_session_factory() as session:
        invitation = await service.create_invitation(session, "trainer-1", "client-1")
        invitation_id = invitation.id

    async def accept(session: AsyncSession):
        return await service.accept_invitation(session, "client-1", invitation_id)

    results = await asyncio.gather(
        _run_in_session(p0_session_factory, accept),
        _run_in_session(p0_session_factory, accept),
    )
    assert results[0].id == results[1].id

    async with p0_session_factory() as session:
        count = await session.scalar(
            select(func.count()).select_from(TrainerClientRelationship)
        )
        assert count == 1


async def test_concurrent_termination_is_idempotent(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await _account(p0_session_factory, "trainer-1", "trainer")
    await _account(p0_session_factory, "client-1", "client")
    async with p0_session_factory() as session:
        invitation = await service.create_invitation(session, "trainer-1", "client-1")
        relationship = await service.accept_invitation(session, "client-1", invitation.id)
        relationship_id = relationship.id

    async def terminate_as_trainer(session: AsyncSession):
        return await service.terminate_relationship(session, "trainer-1", relationship_id)

    async def terminate_as_client(session: AsyncSession):
        return await service.terminate_relationship(session, "client-1", relationship_id)

    results = await asyncio.gather(
        _run_in_session(p0_session_factory, terminate_as_trainer),
        _run_in_session(p0_session_factory, terminate_as_client),
    )
    assert results[0].id == results[1].id
    assert results[0].status == RelationshipStatus.TERMINATED.value
    assert results[1].status == RelationshipStatus.TERMINATED.value


async def test_create_invitation_vs_become_trainer_never_leaves_pending_for_trainer(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await _account(p0_session_factory, "trainer-1", "trainer")
    await _account(p0_session_factory, "client-1", "client")

    async def create(session: AsyncSession):
        return await service.create_invitation(session, "trainer-1", "client-1")

    async def transition(session: AsyncSession):
        return await become_trainer(
            Response(),
            {"sub": "client-1", "role": "client", "sid": "test-session"},
            session,
        )

    await asyncio.gather(
        _run_in_session(p0_session_factory, create),
        _run_in_session(p0_session_factory, transition),
        return_exceptions=True,
    )

    async with p0_session_factory() as session:
        account = await session.get(Account, "client-1")
        pending_count = await session.scalar(
            select(func.count())
            .select_from(TrainerClientInvitation)
            .where(
                TrainerClientInvitation.client_id == "client-1",
                TrainerClientInvitation.status == InvitationStatus.PENDING.value,
            )
        )
        relationship_count = await session.scalar(
            select(func.count()).select_from(TrainerClientRelationship)
        )
        assert account is not None and account.role == "trainer"
        assert pending_count == 0
        assert relationship_count == 0
