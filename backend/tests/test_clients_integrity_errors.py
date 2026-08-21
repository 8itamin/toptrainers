from __future__ import annotations

from types import SimpleNamespace
from typing import cast

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.errors import BusinessRuleError
from toptrainers_api.modules.clients import repository, service
from toptrainers_api.modules.clients.models import InvitationStatus

pytestmark = pytest.mark.asyncio


class _ConstraintViolation(Exception):
    def __init__(self, constraint_name: str) -> None:
        super().__init__(constraint_name)
        self.constraint_name = constraint_name


class _FailingSession:
    def __init__(self, error: IntegrityError) -> None:
        self.error = error
        self.rolled_back = False

    def add(self, _value: object) -> None:
        return None

    async def commit(self) -> None:
        raise self.error

    async def rollback(self) -> None:
        self.rolled_back = True

    async def refresh(self, _value: object) -> None:
        return None


def _integrity_error(constraint_name: str) -> IntegrityError:
    return IntegrityError(
        "INSERT",
        {},
        _ConstraintViolation(constraint_name),
    )


def _prepare_create_invitation(monkeypatch: pytest.MonkeyPatch) -> None:
    async def lock_account(_session: object, _client_id: str) -> object:
        return SimpleNamespace(role="client")

    async def no_relationship(_session: object, _trainer_id: str, _client_id: str) -> None:
        return None

    async def no_invitation(_session: object, _trainer_id: str, _client_id: str) -> None:
        return None

    monkeypatch.setattr(repository, "lock_account", lock_account)
    monkeypatch.setattr(repository, "find_active_relationship", no_relationship)
    monkeypatch.setattr(repository, "find_pending_invitation", no_invitation)


def _prepare_accept_invitation(monkeypatch: pytest.MonkeyPatch) -> None:
    invitation = SimpleNamespace(
        id="invitation-1",
        trainer_id="trainer-1",
        client_id="client-1",
        status=InvitationStatus.PENDING.value,
    )

    async def lock_invitation(_session: object, _invitation_id: str) -> object:
        return invitation

    async def no_relationship(_session: object, _trainer_id: str, _client_id: str) -> None:
        return None

    monkeypatch.setattr(service, "_lock_invitation_with_client", lock_invitation)
    monkeypatch.setattr(repository, "find_active_relationship", no_relationship)


async def test_create_invitation_maps_only_pending_pair_constraint(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _prepare_create_invitation(monkeypatch)
    session = _FailingSession(
        _integrity_error("uq_trainer_client_invitations_pending_pair")
    )

    with pytest.raises(BusinessRuleError) as captured:
        await service.create_invitation(cast(AsyncSession, session), "trainer-1", "client-1")

    assert session.rolled_back is True
    assert captured.value.code == "INVITATION_ALREADY_PENDING"


async def test_create_invitation_reraises_unexpected_integrity_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _prepare_create_invitation(monkeypatch)
    error = _integrity_error("ck_trainer_client_invitations_status")
    session = _FailingSession(error)

    with pytest.raises(IntegrityError) as captured:
        await service.create_invitation(cast(AsyncSession, session), "trainer-1", "client-1")

    assert session.rolled_back is True
    assert captured.value is error


async def test_accept_invitation_maps_only_active_pair_constraint(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _prepare_accept_invitation(monkeypatch)
    session = _FailingSession(
        _integrity_error("uq_trainer_client_relationships_active_pair")
    )

    with pytest.raises(BusinessRuleError) as captured:
        await service.accept_invitation(cast(AsyncSession, session), "client-1", "invitation-1")

    assert session.rolled_back is True
    assert captured.value.code == "ACTIVE_RELATIONSHIP_EXISTS"


async def test_accept_invitation_reraises_unexpected_integrity_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _prepare_accept_invitation(monkeypatch)
    error = _integrity_error("uq_trainer_client_relationships_invitation_id")
    session = _FailingSession(error)

    with pytest.raises(IntegrityError) as captured:
        await service.accept_invitation(cast(AsyncSession, session), "client-1", "invitation-1")

    assert session.rolled_back is True
    assert captured.value is error
