import asyncio
from datetime import UTC, datetime
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi import Response
from sqlalchemy import func, select

from toptrainers_api.core.errors import BusinessRuleError
from toptrainers_api.modules.clients import card_repository, card_service, join_service
from toptrainers_api.modules.clients.models import TrainerClientCard, TrainerClientRelationship
from toptrainers_api.modules.clients.schemas import ClientCardWrite
from toptrainers_api.modules.identity.models import Account
from toptrainers_api.modules.identity.router import become_trainer


async def seed(factory):
    async with factory() as session:
        session.add_all(
            [
                Account(
                    id="trainer",
                    email="trainer@example.com",
                    password_hash="unused",
                    role="trainer",
                ),
                Account(
                    id="client",
                    email="client@example.com",
                    password_hash="unused",
                    role="client",
                    email_verified_at=datetime.now(UTC),
                ),
            ]
        )
        await session.commit()
        card = await card_service.create_card(
            session,
            "trainer",
            ClientCardWrite(display_name="Client", contact_email="client@example.com"),
        )
        invitation = await join_service.issue_join_invitation(session, "trainer", card.id)
        return card.id, parse_qs(urlparse(invitation.url).fragment)["token"][0]


@pytest.mark.asyncio
async def test_double_join_creates_one_relationship(p0_session_factory):
    _, token = await seed(p0_session_factory)

    async def accept():
        async with p0_session_factory() as session:
            return await join_service.accept_join_invitation(session, "client", token)

    first, second = await asyncio.wait_for(asyncio.gather(accept(), accept()), 10)
    assert first.id == second.id
    async with p0_session_factory() as session:
        assert (
            await session.scalar(select(func.count()).select_from(TrainerClientRelationship)) == 1
        )


@pytest.mark.asyncio
@pytest.mark.parametrize("reissue", [False, True])
async def test_cancel_or_reissue_wins_while_accept_waits_for_card(
    p0_session_factory, monkeypatch, reissue
):
    card_id, token = await seed(p0_session_factory)
    looked_up = asyncio.Event()
    original = card_repository.get_join

    async def observe(session, hash_value, lock=False):
        result = await original(session, hash_value, lock)
        if not lock:
            looked_up.set()
        return result

    monkeypatch.setattr(card_repository, "get_join", observe)

    async def accept():
        async with p0_session_factory() as session:
            return await join_service.accept_join_invitation(session, "client", token)

    async with p0_session_factory() as cancelling:
        await cancelling.scalar(
            select(TrainerClientCard).where(TrainerClientCard.id == card_id).with_for_update()
        )
        task = asyncio.create_task(accept())
        await asyncio.wait_for(looked_up.wait(), 10)
        if reissue:
            await join_service.issue_join_invitation(cancelling, "trainer", card_id)
        else:
            await join_service.cancel_join_invitation(cancelling, "trainer", card_id)
        with pytest.raises(BusinessRuleError) as error:
            await asyncio.wait_for(task, 10)
        assert error.value.code == "INVITATION_UNAVAILABLE"
    async with p0_session_factory() as session:
        assert (
            await session.scalar(select(func.count()).select_from(TrainerClientRelationship)) == 0
        )


@pytest.mark.asyncio
async def test_join_and_role_transition_have_one_consistent_winner(p0_session_factory):
    _, token = await seed(p0_session_factory)

    async def accept():
        async with p0_session_factory() as session:
            return await join_service.accept_join_invitation(session, "client", token)

    async def transition():
        async with p0_session_factory() as session:
            return await become_trainer(
                Response(), {"sub": "client", "role": "client", "sid": "test"}, session
            )

    results = await asyncio.wait_for(
        asyncio.gather(accept(), transition(), return_exceptions=True), 10
    )
    assert sum(not isinstance(r, Exception) for r in results) == 1
    async with p0_session_factory() as session:
        account = await session.get(Account, "client")
        count = await session.scalar(select(func.count()).select_from(TrainerClientRelationship))
        assert (account.role, count) in [("client", 1), ("trainer", 0)]
