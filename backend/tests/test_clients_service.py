from __future__ import annotations

from types import SimpleNamespace

import pytest

from toptrainers_api.core.errors import BusinessRuleError
from toptrainers_api.modules.clients import service
from toptrainers_api.modules.clients.models import InvitationStatus, RelationshipStatus


class DummySession:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.commits = 0
        self.refreshed: list[object] = []

    def add(self, value: object) -> None:
        self.added.append(value)

    async def commit(self) -> None:
        self.commits += 1

    async def rollback(self) -> None:
        pass

    async def refresh(self, value: object) -> None:
        self.refreshed.append(value)


@pytest.mark.asyncio
async def test_create_invitation_locks_client_before_pair_checks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []
    session = DummySession()

    async def lock_account(_session: object, client_id: str) -> object:
        calls.append("account")
        return SimpleNamespace(id=client_id, role="client")

    async def no_active(*_args: object) -> None:
        calls.append("active")
        return None

    async def no_pending(*_args: object) -> None:
        calls.append("pending")
        return None

    monkeypatch.setattr(service.repository, "lock_account", lock_account)
    monkeypatch.setattr(service.repository, "find_active_relationship", no_active)
    monkeypatch.setattr(service.repository, "find_pending_invitation", no_pending)

    invitation = await service.create_invitation(session, "trainer-1", "client-1")

    assert calls == ["account", "active", "pending"]
    assert invitation.status == InvitationStatus.PENDING.value
    assert session.commits == 1
    assert session.refreshed == [invitation]


@pytest.mark.asyncio
async def test_create_invitation_rejects_existing_pending(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = DummySession()
    monkeypatch.setattr(
        service.repository,
        "lock_account",
        lambda *_args: _async_value(SimpleNamespace(id="client-1", role="client")),
    )
    monkeypatch.setattr(
        service.repository,
        "find_active_relationship",
        lambda *_args: _async_value(None),
    )
    monkeypatch.setattr(
        service.repository,
        "find_pending_invitation",
        lambda *_args: _async_value(SimpleNamespace(id="inv-1")),
    )

    with pytest.raises(BusinessRuleError) as error:
        await service.create_invitation(session, "trainer-1", "client-1")

    assert error.value.status_code == 409
    assert error.value.code == "INVITATION_ALREADY_PENDING"


@pytest.mark.asyncio
async def test_accept_pending_creates_relationship_after_locks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []
    session = DummySession()
    locked = SimpleNamespace(
        id="inv-1",
        trainer_id="trainer-1",
        client_id="client-1",
        status=InvitationStatus.PENDING.value,
    )

    async def get_invitation_client_id(*_args: object) -> str:
        calls.append("client_id")
        return "client-1"

    async def lock_account(*_args: object) -> object:
        calls.append("account")
        return SimpleNamespace(id="client-1", role="client")

    async def lock_invitation(*_args: object) -> object:
        calls.append("invitation")
        return locked

    monkeypatch.setattr(
        service.repository,
        "get_invitation_client_id",
        get_invitation_client_id,
    )
    monkeypatch.setattr(service.repository, "lock_account", lock_account)
    monkeypatch.setattr(service.repository, "lock_invitation", lock_invitation)
    monkeypatch.setattr(
        service.repository,
        "find_active_relationship",
        lambda *_args: _async_value(None),
    )

    relationship = await service.accept_invitation(session, "client-1", "inv-1")

    assert calls == ["client_id", "account", "invitation"]
    assert locked.status == InvitationStatus.ACCEPTED.value
    assert relationship.status == RelationshipStatus.ACTIVE.value
    assert relationship.invitation_id == "inv-1"
    assert session.commits == 1
    assert session.refreshed == [relationship]


@pytest.mark.asyncio
async def test_double_accept_returns_existing_relationship(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = DummySession()
    invitation = SimpleNamespace(
        id="inv-1",
        trainer_id="trainer-1",
        client_id="client-1",
        status=InvitationStatus.ACCEPTED.value,
    )
    existing = SimpleNamespace(id="rel-1", status=RelationshipStatus.ACTIVE.value)
    monkeypatch.setattr(
        service.repository,
        "get_invitation_client_id",
        lambda *_args: _async_value("client-1"),
    )
    monkeypatch.setattr(
        service.repository,
        "lock_account",
        lambda *_args: _async_value(SimpleNamespace(id="client-1", role="client")),
    )
    monkeypatch.setattr(
        service.repository,
        "lock_invitation",
        lambda *_args: _async_value(invitation),
    )
    monkeypatch.setattr(
        service.repository,
        "lock_relationship_by_invitation",
        lambda *_args: _async_value(existing),
    )

    result = await service.accept_invitation(session, "client-1", "inv-1")
    assert result is existing
    assert session.commits == 0


@pytest.mark.asyncio
async def test_reject_and_cancel_idempotency_is_state_specific(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = DummySession()
    rejected = SimpleNamespace(
        id="inv-r",
        trainer_id="trainer-1",
        client_id="client-1",
        status=InvitationStatus.REJECTED.value,
    )
    cancelled = SimpleNamespace(
        id="inv-c",
        trainer_id="trainer-1",
        client_id="client-1",
        status=InvitationStatus.CANCELLED.value,
    )

    def setup(invitation: object) -> None:
        monkeypatch.setattr(
            service.repository,
            "get_invitation_client_id",
            lambda *_args: _async_value("client-1"),
        )
        monkeypatch.setattr(
            service.repository,
            "lock_account",
            lambda *_args: _async_value(
                SimpleNamespace(id="client-1", role="client")
            ),
        )
        monkeypatch.setattr(
            service.repository,
            "lock_invitation",
            lambda *_args: _async_value(invitation),
        )

    setup(rejected)
    assert await service.reject_invitation(session, "client-1", "inv-r") is rejected

    setup(cancelled)
    assert await service.cancel_invitation(session, "trainer-1", "inv-c") is cancelled

    setup(cancelled)
    with pytest.raises(BusinessRuleError) as error:
        await service.reject_invitation(session, "client-1", "inv-c")
    assert error.value.code == "INVITATION_STATE_CONFLICT"


@pytest.mark.asyncio
async def test_terminate_relationship_is_idempotent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = DummySession()
    relationship = SimpleNamespace(
        id="rel-1",
        trainer_id="trainer-1",
        client_id="client-1",
        status=RelationshipStatus.TERMINATED.value,
        terminated_at=object(),
    )
    monkeypatch.setattr(
        service.repository,
        "get_relationship_client_id",
        lambda *_args: _async_value("client-1"),
    )
    monkeypatch.setattr(
        service.repository,
        "lock_account",
        lambda *_args: _async_value(SimpleNamespace(id="client-1", role="client")),
    )
    monkeypatch.setattr(
        service.repository,
        "lock_relationship",
        lambda *_args: _async_value(relationship),
    )

    result = await service.terminate_relationship(session, "trainer-1", "rel-1")
    assert result is relationship
    assert session.commits == 0


async def _async_value(value: object) -> object:
    return value
