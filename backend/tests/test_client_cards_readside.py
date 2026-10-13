from datetime import UTC, datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from toptrainers_api.modules.clients import card_service
from toptrainers_api.modules.clients.models import (
    TrainerClientCard,
    TrainerClientInvitation,
    TrainerClientRelationship,
)
from toptrainers_api.modules.identity.models import Account


@pytest.mark.asyncio
async def test_real_projection_owner_groups_and_cursor():
    engine = create_engine("sqlite://")
    for model in [Account, TrainerClientInvitation, TrainerClientRelationship, TrainerClientCard]:
        model.__table__.create(engine)
    with Session(engine, expire_on_commit=False) as session:
        session.add(
            TrainerClientCard(
                id="1",
                trainer_id="trainer",
                display_name="Ivan",
                contact_email=None,
                client_account_id="client",
                created_at=datetime.now(UTC),
            )
        )
        session.add(
            TrainerClientCard(
                id="2",
                trainer_id="trainer",
                display_name="Waiting",
                contact_email=None,
                created_at=datetime.now(UTC),
            )
        )
        session.add(
            TrainerClientCard(
                id="3",
                trainer_id="other",
                display_name="Private",
                contact_email=None,
                created_at=datetime.now(UTC),
            )
        )
        session.add(
            TrainerClientRelationship(
                id="r",
                trainer_id="trainer",
                client_id="client",
                invitation_id="inv",
                status="ACTIVE",
            )
        )
        session.commit()

        class Adapter:
            async def execute(self, query):
                return session.execute(query)

        first = await card_service.list_cards(Adapter(), "trainer", "all", "", None, 1)
        assert [c.id for c in first.items] == ["1"]
        assert first.counts == {"active": 1, "pending": 1}
        assert first.next_cursor == "1"
        second = await card_service.list_cards(
            Adapter(), "trainer", "all", "", first.next_cursor, 1
        )
        assert [c.id for c in second.items] == ["2"]
        assert second.next_cursor is None
        search = await card_service.list_cards(Adapter(), "trainer", "active", "ivan", None, 30)
        assert search.items[0].relationship_id == "r"
        session.get(TrainerClientRelationship, "r").status = "TERMINATED"
        session.commit()
        past = await card_service.list_cards(Adapter(), "trainer", "past", "", None, 30)
        assert past.items[0].id == "1"
    engine.dispose()
