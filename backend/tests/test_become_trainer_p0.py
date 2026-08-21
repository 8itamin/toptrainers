from types import SimpleNamespace

import pytest
from fastapi import HTTPException, Response
from sqlalchemy.dialects import postgresql

from toptrainers_api.modules.identity import router


class DummySession:
    def __init__(self, account: object) -> None:
        self.account = account
        self.statement = None
        self.added: list[object] = []
        self.commits = 0

    async def get(self, *_args: object) -> object:
        return self.account

    async def scalar(self, statement: object) -> object:
        self.statement = statement
        return self.account

    def add(self, value: object) -> None:
        self.added.append(value)

    async def commit(self) -> None:
        self.commits += 1


@pytest.mark.asyncio
async def test_become_trainer_rejects_any_client_p0_footprint(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stored = SimpleNamespace(id="client-1", role="client")
    session = DummySession(stored)

    async def has_footprint(*_args: object) -> bool:
        return True

    monkeypatch.setattr(
        router.clients_service,
        "has_client_p0_footprint",
        has_footprint,
    )

    with pytest.raises(HTTPException) as error:
        await router.become_trainer(
            Response(),
            {"sub": "client-1", "role": "client", "sid": "old"},
            session,
        )

    assert error.value.status_code == 409
    assert error.value.detail == {
        "code": "BECOME_TRAINER_P0_FOOTPRINT_EXISTS",
        "message": "Client account has trainer-client P0 history",
    }
    assert stored.role == "client"
    assert session.commits == 0


@pytest.mark.asyncio
async def test_become_trainer_locks_account_before_footprint_check(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stored = SimpleNamespace(id="client-1", role="client")
    session = DummySession(stored)
    calls: list[str] = []

    async def has_footprint(*_args: object) -> bool:
        calls.append("footprint")
        assert session.statement is not None
        sql = str(
            session.statement.compile(
                dialect=postgresql.dialect(),
                compile_kwargs={"literal_binds": True},
            )
        )
        assert sql.endswith("FOR UPDATE")
        return True

    monkeypatch.setattr(
        router.clients_service,
        "has_client_p0_footprint",
        has_footprint,
    )

    with pytest.raises(HTTPException):
        await router.become_trainer(
            Response(),
            {"sub": "client-1", "role": "client", "sid": "old"},
            session,
        )

    assert calls == ["footprint"]


def test_become_trainer_documents_409_business_error() -> None:
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(router.router)
    operation = app.openapi()["paths"]["/auth/become-trainer"]["post"]
    assert "409" in operation["responses"]
