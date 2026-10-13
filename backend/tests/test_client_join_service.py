from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from toptrainers_api.core.errors import BusinessRuleError
from toptrainers_api.modules.clients import card_service, join_service


@pytest.mark.asyncio
async def test_foreign_card_is_not_found(monkeypatch):
    monkeypatch.setattr(
        card_service.repo, "get_card", AsyncMock(return_value=SimpleNamespace(trainer_id="other"))
    )
    with pytest.raises(BusinessRuleError) as error:
        await card_service.owned_card(object(), "trainer", "card")
    assert error.value.status_code == 404


@pytest.mark.asyncio
async def test_issue_stores_hash_and_seven_day_expiry(monkeypatch):
    card = SimpleNamespace(client_account_id=None)
    monkeypatch.setattr(join_service, "owned_card", AsyncMock(return_value=card))
    session = SimpleNamespace(
        execute=AsyncMock(), commit=AsyncMock(), add=lambda value: added.append(value)
    )
    added = []
    before = datetime.now(UTC)
    result = await join_service.issue_join_invitation(session, "trainer", "card")
    raw = result.url.split("token=")[1]
    assert added[0].token_hash == join_service.token_hash(raw)
    assert raw != added[0].token_hash
    assert before + timedelta(days=7) <= result.expires_at <= datetime.now(UTC) + timedelta(days=7)
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_accept_checks_account_before_card_and_rejects_email(monkeypatch):
    calls = []

    async def account(*args):
        calls.append("account")
        return SimpleNamespace(
            role="client", email_verified_at=datetime.now(UTC), email="other@example.com"
        )

    async def card(*args):
        calls.append("card")
        return SimpleNamespace(contact_email="target@example.com")

    invitation = SimpleNamespace(
        card_id="card", status="PENDING", expires_at=datetime.now(UTC) + timedelta(days=1)
    )
    monkeypatch.setattr(join_service, "lock_account_for_client_join", account)
    monkeypatch.setattr(join_service.repo, "get_join", AsyncMock(return_value=invitation))
    monkeypatch.setattr(join_service.repo, "get_card", card)
    with pytest.raises(BusinessRuleError) as error:
        await join_service.accept_join_invitation(object(), "client", "a" * 43)
    assert error.value.code == "INVITATION_EMAIL_MISMATCH"
    assert calls == ["account", "card"]


@pytest.mark.asyncio
async def test_same_client_retry_returns_original_relationship(monkeypatch):
    account = SimpleNamespace(role="client", email_verified_at=datetime.now(UTC))
    card = SimpleNamespace(client_account_id="client")
    invitation = SimpleNamespace(card_id="card", status="ACCEPTED", relationship_id="relationship")
    relationship = SimpleNamespace(id="relationship", status="TERMINATED")
    monkeypatch.setattr(
        join_service, "lock_account_for_client_join", AsyncMock(return_value=account)
    )
    monkeypatch.setattr(join_service.repo, "get_join", AsyncMock(return_value=invitation))
    monkeypatch.setattr(join_service.repo, "get_card", AsyncMock(return_value=card))
    monkeypatch.setattr(
        join_service.repository, "get_relationship", AsyncMock(return_value=relationship)
    )
    assert await join_service.accept_join_invitation(object(), "client", "a" * 43) is relationship


@pytest.mark.asyncio
async def test_email_failure_preserves_issued_link(monkeypatch):
    from toptrainers_api.modules.clients import card_router
    from toptrainers_api.modules.clients.schemas import IssuedJoinInvitation

    result = IssuedJoinInvitation(
        id="join",
        url="https://example.com/client-invite?token=opaque",
        expires_at=datetime.now(UTC),
    )
    monkeypatch.setattr(
        card_router.card_service,
        "owned_card",
        AsyncMock(
            return_value=SimpleNamespace(contact_email="test@example.com", display_name="<Ivan>")
        ),
    )
    monkeypatch.setattr(card_router, "issue", AsyncMock(return_value=result))
    send = AsyncMock(side_effect=RuntimeError("SMTP unavailable"))
    monkeypatch.setattr(card_router, "send_email", send)
    response = await card_router.email_invite(
        "card", {"sub": "trainer", "role": "trainer"}, object(), object(), object()
    )
    assert response.delivery_status == "FAILED"
    assert response.url == result.url
    assert "&lt;Ivan&gt;" in send.call_args.args[2]
