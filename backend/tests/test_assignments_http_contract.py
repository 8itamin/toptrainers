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
        trainer = Account(
            id=TRAINER_ID,
            email="trainer-http@example.test",
            password_hash="test",
            role="trainer",
        )
        client = Account(
            id=CLIENT_ID,
            email="client-http@example.test",
            password_hash="test",
            role="client",
        )
        session.add_all([trainer, client])
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


async def test_client_cannot_create_assignment(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with http_client(p0_session_factory, CLIENT_ID, "client") as client:
        response = await client.post(
            "/assignments",
            json={
                "client_id": CLIENT_ID,
                "workout_id": WORKOUT_ID,
                "scheduled_date": "2026-08-25",
                "request_id": "http-role",
            },
        )
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "ROLE_NOT_ALLOWED"


async def test_http_create_reschedule_cancel_contract(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_sources(p0_session_factory)
    async with http_client(p0_session_factory, TRAINER_ID, "trainer") as client:
        created = await client.post(
            "/assignments",
            json={
                "client_id": CLIENT_ID,
                "workout_id": WORKOUT_ID,
                "scheduled_date": "2026-08-25",
                "request_id": "http-1",
            },
        )
        assert created.status_code == 201
        body = created.json()
        assert body["client_id"] == CLIENT_ID
        assert body["source_workout_id"] == WORKOUT_ID
        assert body["scheduled_date"] == "2026-08-25"
        assert body["status"] == "PLANNED"
        assert body["workout_snapshot"]["blocks"][0]["exercises"][0]["title"] == "Squat"

        assignment_id = body["id"]
        rescheduled = await client.post(
            f"/assignments/{assignment_id}/reschedule",
            json={"scheduled_date": date(2026, 8, 26).isoformat()},
        )
        assert rescheduled.status_code == 200
        assert rescheduled.json()["scheduled_date"] == "2026-08-26"

        cancelled = await client.post(f"/assignments/{assignment_id}/cancel")
        assert cancelled.status_code == 200
        assert cancelled.json()["status"] == "CANCELLED"

        stale_retry = await client.post(f"/assignments/{assignment_id}/cancel")
        assert stale_retry.status_code == 409
        assert stale_retry.json()["detail"]["code"] == "ASSIGNMENT_NOT_PLANNED"


async def test_assignment_openapi_has_explicit_operation_ids_and_typed_snapshot() -> None:
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    schema = app.openapi()
    assert schema["paths"]["/api/v1/assignments"]["post"]["operationId"] == (
        "createWorkoutAssignment"
    )
    assert schema["paths"]["/api/v1/assignments/{assignment_id}/reschedule"]["post"][
        "operationId"
    ] == "rescheduleWorkoutAssignment"
    assert schema["paths"]["/api/v1/assignments/{assignment_id}/cancel"]["post"][
        "operationId"
    ] == "cancelWorkoutAssignment"
    components = schema["components"]["schemas"]
    assert "WorkoutSnapshotV1" in components
    assert "WorkoutSnapshotBlockV1" in components
    assert "WorkoutSnapshotExerciseV1" in components
    request = components["CreateWorkoutAssignmentRequest"]["properties"]
    assert set(request) == {"client_id", "workout_id", "scheduled_date", "request_id"}
    assert request["scheduled_date"]["format"] == "date"
