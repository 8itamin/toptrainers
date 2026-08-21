from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from toptrainers_api.core.errors import BusinessRuleError
from toptrainers_api.modules.clients import repository, service
from toptrainers_api.modules.clients.models import (
    InvitationStatus,
    RelationshipStatus,
    TrainerClientInvitation,
    TrainerClientRelationship,
)
from toptrainers_api.modules.identity.models import Account
from toptrainers_api.modules.identity.router import become_trainer

pytestmark = pytest.mark.asyncio
ROLE_CHANGE_REASON = "CLIENT_ROLE_CHANGED_TO_TRAINER"


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


async def _setup_pair(factory: async_sessionmaker[AsyncSession]) -> None:
    await _account(factory, "trainer-1", "trainer")
    await _account(factory, "client-1", "client")


async def _transition(session: AsyncSession):
    return await become_trainer(
        Response(),
        {"sub": "client-1", "role": "client", "sid": "old-session"},
        session,
    )


async def _pending_invitation(factory: async_sessionmaker[AsyncSession]) -> str:
    async with factory() as session:
        invitation = await service.create_invitation(session, "trainer-1", "client-1")
        return invitation.id


async def test_btr_v2_01_pending_invitation_is_not_permanent_footprint(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await _setup_pair(p0_session_factory)
    await _pending_invitation(p0_session_factory)
    async with p0_session_factory() as session:
        assert await service.has_client_p0_footprint(session, "client-1") is False


async def test_btr_v2_02_transition_cancels_pending_inbound_invitation(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await _setup_pair(p0_session_factory)
    invitation_id = await _pending_invitation(p0_session_factory)
    async with p0_session_factory() as session:
        result = await _transition(session)
        assert result.role.value == "trainer"
    async with p0_session_factory() as session:
        invitation = await session.get(TrainerClientInvitation, invitation_id)
        account = await session.get(Account, "client-1")
        assert account is not None and account.role == "trainer"
        assert invitation is not None
        assert invitation.status == InvitationStatus.CANCELLED.value
        assert invitation.resolved_at is not None
        assert invitation.resolved_by_account_id is None
        assert invitation.resolution_reason == ROLE_CHANGE_REASON


async def test_btr_v2_03_active_relationship_blocks_transition(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await _setup_pair(p0_session_factory)
    invitation_id = await _pending_invitation(p0_session_factory)
    async with p0_session_factory() as session:
        await service.accept_invitation(session, "client-1", invitation_id)
    async with p0_session_factory() as session:
        with pytest.raises(HTTPException) as error:
            await _transition(session)
        assert error.value.status_code == 409
        assert error.value.detail["code"] == "BECOME_TRAINER_P0_FOOTPRINT_EXISTS"


async def test_btr_v2_04_terminated_relationship_still_blocks_transition(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await _setup_pair(p0_session_factory)
    invitation_id = await _pending_invitation(p0_session_factory)
    async with p0_session_factory() as session:
        relationship = await service.accept_invitation(session, "client-1", invitation_id)
        await service.terminate_relationship(session, "client-1", relationship.id)
    async with p0_session_factory() as session:
        with pytest.raises(HTTPException) as error:
            await _transition(session)
        assert error.value.detail["code"] == "BECOME_TRAINER_P0_FOOTPRINT_EXISTS"


async def test_btr_v2_05_transition_cancels_all_inbound_pending_invitations(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await _setup_pair(p0_session_factory)
    await _account(p0_session_factory, "trainer-2", "trainer")
    async with p0_session_factory() as session:
        await service.create_invitation(session, "trainer-1", "client-1")
        await service.create_invitation(session, "trainer-2", "client-1")
    async with p0_session_factory() as session:
        await _transition(session)
    async with p0_session_factory() as session:
        pending = await session.scalar(
            select(func.count())
            .select_from(TrainerClientInvitation)
            .where(
                TrainerClientInvitation.client_id == "client-1",
                TrainerClientInvitation.status == InvitationStatus.PENDING.value,
            )
        )
        invitations = (
            await session.scalars(
                select(TrainerClientInvitation).where(
                    TrainerClientInvitation.client_id == "client-1"
                )
            )
        ).all()
        assert pending == 0
        assert len(invitations) == 2
        assert all(row.resolution_reason == ROLE_CHANGE_REASON for row in invitations)


async def test_btr_v2_06_rejected_invitation_does_not_block_transition(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await _setup_pair(p0_session_factory)
    invitation_id = await _pending_invitation(p0_session_factory)
    async with p0_session_factory() as session:
        await service.reject_invitation(session, "client-1", invitation_id)
    async with p0_session_factory() as session:
        result = await _transition(session)
        assert result.role.value == "trainer"


async def test_btr_v2_07_cancelled_invitation_does_not_block_transition(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await _setup_pair(p0_session_factory)
    invitation_id = await _pending_invitation(p0_session_factory)
    async with p0_session_factory() as session:
        await service.cancel_invitation(session, "trainer-1", invitation_id)
    async with p0_session_factory() as session:
        result = await _transition(session)
        assert result.role.value == "trainer"


async def test_btr_v2_08_accept_after_role_change_has_specific_conflict(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await _setup_pair(p0_session_factory)
    invitation_id = await _pending_invitation(p0_session_factory)
    async with p0_session_factory() as session:
        await _transition(session)
    async with p0_session_factory() as session:
        with pytest.raises(BusinessRuleError) as error:
            await service.accept_invitation(session, "client-1", invitation_id)
        assert error.value.status_code == 409
        assert error.value.code == "INVITATION_CANCELLED_BY_ROLE_CHANGE"


async def test_btr_v2_09_accept_wins_deterministic_race(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await _setup_pair(p0_session_factory)
    invitation_id = await _pending_invitation(p0_session_factory)
    async with p0_session_factory() as accept_session, p0_session_factory() as btr_session:
        await repository.lock_account(accept_session, "client-1")
        btr_task = asyncio.create_task(_transition(btr_session))
        await asyncio.sleep(0.05)
        assert not btr_task.done()
        relationship = await service.accept_invitation(
            accept_session, "client-1", invitation_id
        )
        with pytest.raises(HTTPException) as error:
            await btr_task
        assert relationship.status == RelationshipStatus.ACTIVE.value
        assert error.value.detail["code"] == "BECOME_TRAINER_P0_FOOTPRINT_EXISTS"
    async with p0_session_factory() as session:
        account = await session.get(Account, "client-1")
        assert account is not None and account.role == "client"


async def test_btr_v2_10_become_trainer_wins_deterministic_race(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await _setup_pair(p0_session_factory)
    invitation_id = await _pending_invitation(p0_session_factory)
    async with p0_session_factory() as btr_session, p0_session_factory() as accept_session:
        await repository.lock_account(btr_session, "client-1")
        accept_task = asyncio.create_task(
            service.accept_invitation(accept_session, "client-1", invitation_id)
        )
        await asyncio.sleep(0.05)
        assert not accept_task.done()

        result = None
        transition_error = None
        try:
            result = await _transition(btr_session)
        except HTTPException as error:
            transition_error = error
            await btr_session.rollback()

        accept_error = None
        try:
            await accept_task
        except BusinessRuleError as error:
            accept_error = error

        assert transition_error is None
        assert result is not None and result.role.value == "trainer"
        assert accept_error is not None
        assert accept_error.code == "INVITATION_CANCELLED_BY_ROLE_CHANGE"
    async with p0_session_factory() as session:
        relationship_count = await session.scalar(
            select(func.count()).select_from(TrainerClientRelationship)
        )
        assert relationship_count == 0


async def test_btr_v2_11_create_invitation_vs_transition_never_leaves_pending_for_trainer(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await _setup_pair(p0_session_factory)

    async def create() -> object:
        async with p0_session_factory() as session:
            return await service.create_invitation(session, "trainer-1", "client-1")

    async def transition() -> object:
        async with p0_session_factory() as session:
            return await _transition(session)

    await asyncio.gather(create(), transition(), return_exceptions=True)
    async with p0_session_factory() as session:
        account = await session.get(Account, "client-1")
        pending = await session.scalar(
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
        assert pending == 0
        assert relationship_count == 0
