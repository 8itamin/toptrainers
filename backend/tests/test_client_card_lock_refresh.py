from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from toptrainers_api.core.errors import BusinessRuleError
from toptrainers_api.modules.clients import card_repository, join_service
from toptrainers_api.modules.clients.models import ClientJoinInvitation


@pytest.mark.asyncio
async def test_locked_read_reloads_cancellation_in_identity_map():
    # Exercise a real ORM identity map. PostgreSQL row-lock scheduling requires a test database.
    engine = create_engine("sqlite://")
    ClientJoinInvitation.__table__.create(engine)
    with Session(engine, expire_on_commit=False) as original, Session(engine) as cancelling:
        row = ClientJoinInvitation(
            id="join",
            card_id="card",
            token_hash="h" * 64,
            status="PENDING",
            expires_at=datetime.now(UTC) + timedelta(days=1),
        )
        original.add(row)
        original.commit()
        cancelled = cancelling.get(ClientJoinInvitation, "join")
        cancelled.status = "CANCELLED"
        cancelling.commit()

        class Adapter:
            async def scalar(self, query):
                return original.scalar(query)

        refreshed = await card_repository.get_join(Adapter(), "h" * 64, True)
        assert refreshed is row
        assert refreshed.status == "CANCELLED"
        with pytest.raises(BusinessRuleError):
            join_service.validate_join(refreshed)
    engine.dispose()
