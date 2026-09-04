from __future__ import annotations

from collections.abc import AsyncIterator
from typing import cast

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.app.factory import create_app
from toptrainers_api.core.auth import current_account
from toptrainers_api.core.db import get_session
from toptrainers_api.modules.assignments.history_router import router as history_router


def test_workout_history_openapi_is_authoritative_and_minimal() -> None:
    schema = create_app().openapi()
    client_operation = schema["paths"]["/api/v1/workout-history"]["get"]
    trainer_operation = schema["paths"][
        "/api/v1/clients/{client_id}/workout-history"
    ]["get"]

    assert client_operation["operationId"] == "listClientWorkoutHistory"
    assert trainer_operation["operationId"] == "listTrainerClientWorkoutHistory"
    for operation in (client_operation, trainer_operation):
        response_schema = operation["responses"]["200"]["content"]["application/json"]["schema"]
        assert response_schema["$ref"] == "#/components/schemas/WorkoutHistoryPage"
        limit = next(
            parameter for parameter in operation["parameters"] if parameter["name"] == "limit"
        )
        assert limit["schema"]["default"] == 20
        assert limit["schema"]["minimum"] == 1
        assert limit["schema"]["maximum"] == 50

    item_schema = schema["components"]["schemas"]["WorkoutHistoryItem"]
    assert set(item_schema["properties"]) == {
        "assignment_id",
        "relationship_id",
        "trainer_id",
        "client_id",
        "workout_title",
        "scheduled_date",
        "started_at",
        "completed_at",
    }
    assert "workout_snapshot" not in item_schema["properties"]


async def _http_client(role: str) -> AsyncClient:
    app = FastAPI()
    app.include_router(history_router)

    async def override_account() -> dict[str, object]:
        return {"sub": "11111111-1111-1111-1111-111111111111", "role": role}

    async def override_session() -> AsyncIterator[AsyncSession]:
        yield cast(AsyncSession, object())

    app.dependency_overrides[current_account] = override_account
    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://testserver")


@pytest.mark.asyncio
async def test_history_endpoints_enforce_role_boundary_before_query() -> None:
    client = await _http_client("trainer")
    async with client:
        client_side = await client.get("/workout-history")
    assert client_side.status_code == 403
    assert client_side.json()["detail"]["code"] == "ROLE_NOT_ALLOWED"

    trainer = await _http_client("client")
    async with trainer:
        trainer_side = await trainer.get(
            "/clients/22222222-2222-2222-2222-222222222222/workout-history"
        )
    assert trainer_side.status_code == 403
    assert trainer_side.json()["detail"]["code"] == "ROLE_NOT_ALLOWED"


@pytest.mark.asyncio
async def test_malformed_history_cursor_returns_422() -> None:
    client = await _http_client("client")
    async with client:
        response = await client.get("/workout-history?cursor=not-a-valid-cursor")
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "INVALID_HISTORY_CURSOR"
