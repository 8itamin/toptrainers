from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from toptrainers_api.modules.clients import card_service


@pytest.mark.asyncio
async def test_legacy_accept_links_existing_email_card_before_invitation_lock(monkeypatch):
    account = SimpleNamespace(id="client", email="client@example.com")
    invitation = SimpleNamespace(client_id="client", trainer_id="trainer", status="PENDING")
    card = SimpleNamespace(id="card", client_account_id=None)
    monkeypatch.setattr(
        card_service, "lock_legacy_account", AsyncMock(return_value=account), raising=False
    )
    monkeypatch.setattr(
        card_service, "read_legacy_invitation", AsyncMock(return_value=invitation), raising=False
    )
    monkeypatch.setattr(
        card_service.repo, "find_card_for_account", AsyncMock(return_value=card), raising=False
    )
    session = SimpleNamespace(execute=AsyncMock(), add=lambda _: None)
    await card_service.prepare_legacy_accept_card(session, "client", "invite")
    assert card.client_account_id == "client"
    session.execute.assert_awaited_once()
