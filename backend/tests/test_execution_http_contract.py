from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import date
from decimal import Decimal

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from toptrainers_api.core.auth import current_account
from toptrainers_api.core.db import get_session
from toptrainers_api.modules.assignments.router import router
from toptrainers_api.modules.clients.models import (
    InvitationStatus,
    RelationshipStatus,
    TrainerClientInvitation,
    TrainerClientRelationship,
)
from toptrainers_api.modules.exercises.models import Exercise
from toptrainers_api.modules.identity.models import Account
from toptrainers_api.modules.workouts.models import Workout, WorkoutBlock, WorkoutExercise

pytestmark = pytest.mark.asyncio

TRAINER_ID = "11111111-1111-1111-1111-111111111111"
CLIENT_ID = "22222222-2222-2222-2222-222222222222"
RELATIONSHIP_ID = "44444444-4444-4444-4444-444444444444"
WORKOUT_ID = "55555555-5555-5555-5555-555555555555"
EXERCISE_ID = "66666666-6666-6666-6666-666666666666"


async def seed_sources(factory: async_sessionmaker[AsyncSession]) -> None:
    async with factory() as session:
        session.add_all(
            [
                Account(
                    id=TRAINER_ID,
                    email="trainer-execution-http@example.test",
                    password_hash="test",
                    role="trainer",
                ),
                Account(
                    id=CLIENT_ID,
                    email="client-execution-http@example.test",
                    password_hash="test",
                    role="client",
                ),
            ]
        )
        await session.flush()
        invitation = TrainerClientInvitation(
            id="77777777-7777-7777-7777-777777777777",
            trainer_id=TRAINER_ID,
            client_id=CLIENT_ID,
            status=InvitationStatus.ACCEPTED.value,
        )
        session.add(invitation)
        await session.flush()
        relationship = TrainerClientRelationship(
            id=RELATIONSHIP_ID,
            trainer_id=TRAINER_ID,
            client_id=CLIENT_ID,
            invitation_id=invitation.id,
            status=RelationshipStatus.ACTIVE.value,
        )
        exercise = Exercise(
            id=EXERCISE_ID,
            trainer_id=TRAINER_ID,
            title="Squat",
            direction="strength",
            muscle_group="legs",
            instruction="Neutral back",
            reference_url=None,
            video_platform=None,
            video_url=None,
            video_file_url=None,
            thumbnail_url=None,
        )
        workout = Workout(
            id=WORKOUT_ID,
            trainer_id=TRAINER_ID,
            title="Leg day",
            description="",
        )
        block = WorkoutBlock(
            id="88888888-8888-8888-8888-888888888888",
            kind="main",
            position=0,
        )
        block.items.append(
            WorkoutExercise(
                id="99999999-9999-9999-9999-999999999999",
                exercise_id=EXERCISE_ID,
                position=0,
                weight_kg=Decimal("40.00"),
                sets=3,
                reps=8,
            )
        )
        workout.blocks.append(block)
        session.add_all([relationship, exercise, workout])
        await session.commit()


@asynccontextmanager
async def http_client(
    factory: async_sessionmaker[AsyncSession],
    actor_id: str,
    role: str,
) -> AsyncIterator[AsyncClient]:
    app = FastAPI()
    app.include_router(router)

    async def override_current_account() -> dict[str, object]:
        return {"sub": actor_id, "role": role, "sid": "test-session"}

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session

    app.dependency_overrides[current_account] = override_current_account
    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


async def create_assignment(factory: async_sessionmaker[AsyncSession], request_id: str) -> str:
    async with http_client(factory, TRAINER_ID, "trainer") as client:
        response = await client.post(
            "/assignments",
            json={
                "client_id": CLIENT_ID,
                "workout_id": WORKOUT_ID,
                "scheduled_date": date(2026, 8, 25).isoformat(),
                "request_id": request_id,
            },
        )
    assert response.status_code == 201
    return str(response.json()["id"])


async def test_execution_http_lifecycle_and_permissions(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_sources(p0_session_factory)
    assignment_id = await create_assignment(p0_session_factory, "execution-http")

    async with http_client(p0_session_factory, TRAINER_ID, "trainer") as trainer:
        forbidden_start = await trainer.post(f"/assignments/{assignment_id}/execution/start")
        before_start = await trainer.get(f"/assignments/{assignment_id}/execution")
    assert forbidden_start.status_code == 403
    assert forbidden_start.json()["detail"]["code"] == "ROLE_NOT_ALLOWED"
    assert before_start.status_code == 404
    assert before_start.json()["detail"]["code"] == "EXECUTION_NOT_FOUND"

    async with http_client(p0_session_factory, CLIENT_ID, "client") as client:
        started = await client.post(f"/assignments/{assignment_id}/execution/start")
        repeated_start = await client.post(f"/assignments/{assignment_id}/execution/start")
    assert started.status_code == 200
    assert repeated_start.status_code == 200
    assert repeated_start.json()["id"] == started.json()["id"]
    assert repeated_start.json()["started_at"] == started.json()["started_at"]
    assert started.json()["status"] == "IN_PROGRESS"

    async with http_client(p0_session_factory, TRAINER_ID, "trainer") as trainer:
        trainer_read = await trainer.get(f"/assignments/{assignment_id}/execution")
        forbidden_complete = await trainer.post(
            f"/assignments/{assignment_id}/execution/complete"
        )
    assert trainer_read.status_code == 200
    assert trainer_read.json()["id"] == started.json()["id"]
    assert forbidden_complete.status_code == 403
    assert forbidden_complete.json()["detail"]["code"] == "ROLE_NOT_ALLOWED"

    async with http_client(p0_session_factory, CLIENT_ID, "client") as client:
        completed = await client.post(f"/assignments/{assignment_id}/execution/complete")
        repeated_complete = await client.post(f"/assignments/{assignment_id}/execution/complete")
    assert completed.status_code == 200
    assert repeated_complete.status_code == 200
    assert completed.json()["status"] == "COMPLETED"
    assert repeated_complete.json()["completed_at"] == completed.json()["completed_at"]


async def test_execution_openapi_has_explicit_operation_ids_and_derived_status() -> None:
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    schema = app.openapi()
    expected = {
        "/api/v1/assignments/{assignment_id}/execution/start": (
            "post",
            "startWorkoutExecution",
        ),
        "/api/v1/assignments/{assignment_id}/execution": ("get", "getWorkoutExecution"),
        "/api/v1/assignments/{assignment_id}/execution/complete": (
            "post",
            "completeWorkoutExecution",
        ),
    }
    for path, (method, operation_id) in expected.items():
        operation = schema["paths"][path][method]
        assert operation["operationId"] == operation_id
        assert operation["responses"]["200"]["content"]["application/json"]["schema"] == {
            "$ref": "#/components/schemas/WorkoutExecutionResponse"
        }
        if method == "post":
            assert "requestBody" not in operation

    response_schema = schema["components"]["schemas"]["WorkoutExecutionResponse"]
    assert response_schema["properties"]["status"]["enum"] == ["IN_PROGRESS", "COMPLETED"]
