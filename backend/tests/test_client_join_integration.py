from datetime import UTC, datetime
from urllib.parse import parse_qs, urlparse

import pytest
from sqlalchemy import func, select

from toptrainers_api.modules.clients import card_service, join_service, service
from toptrainers_api.modules.clients.models import TrainerClientCard, TrainerClientRelationship
from toptrainers_api.modules.clients.schemas import ClientCardWrite
from toptrainers_api.modules.identity.models import Account


@pytest.mark.asyncio
async def test_card_join_accept_retry_terminate_and_legacy_sync(p0_session_factory):
    async with p0_session_factory() as session:
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
            ClientCardWrite(display_name="Иван", contact_email="client@example.com"),
        )
        link = await join_service.issue_join_invitation(session, "trainer", card.id)
        token = parse_qs(urlparse(link.url).fragment)["token"][0]
        relationship = await join_service.accept_join_invitation(session, "client", token)
        retry = await join_service.accept_join_invitation(session, "client", token)
        assert retry.id == relationship.id
        assert (
            await session.scalar(select(func.count()).select_from(TrainerClientRelationship)) == 1
        )
        page = await card_service.list_cards(session, "trainer", "active", "Иван", None, 30)
        assert page.items[0].client_account_id == "client"
        await service.terminate_relationship(session, "trainer", relationship.id)
        invitation = await service.create_invitation(session, "trainer", "client")
        await service.accept_invitation(session, "client", invitation.id)
        assert await session.scalar(select(func.count()).select_from(TrainerClientCard)) == 1
