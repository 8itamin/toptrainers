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
from toptrainers_api.modules.assignments import service as assignment_service
from toptrainers_api.modules.assignments.models import WorkoutAssignment, WorkoutAssignmentStatus
from toptrainers_api.modules.assignments.router import router
from toptrainers_api.modules.assignments.schemas import CreateWorkoutAssignmentRequest
from toptrainers_api.modules.clients import service as clients_service
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
OTHER_CLIENT_ID = "33333333-3333-3333-3333-333333333333"
RELATIONSHIP_ID = "44444444-4444-4444-4444-444444444444"
OTHER_RELATIONSHIP_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
WORKOUT_ID = "55555555-5555-5555-5555-555555555555"
EXERCISE_ID = "66666666-6666-6666-6666-666666666666"
TARGET_DATE = date(2026, 8, 25)


async def seed_sources(factory: async_sessionmaker[AsyncSession]) -> None:
    async with factory() as session:
        trainer = Account(
            id=TRAINER_ID,
            email="trainer-read@example.test",
            password_hash="test",
            role="trainer",
        )
        client = Account(
            id=CLIENT_ID,
            email="client-read@example.test",
            password_hash="test",
            role="client",
        )
        other_client = Account(
            id=OTHER_CLIENT_ID,
            email="other-client-read@example.test",
            password_hash="test",
            role="client",
        )
        session.add_all([trainer, client, other_client])
        await session.flush()

        invitation = TrainerClientInvitation(
            id="77777777-7777-7777-7777-777777777777",
            trainer_id=TRAINER_ID,
            client_id=CLIENT_ID,
            status=InvitationStatus.ACCEPTED.value,
        )
        other_invitation = TrainerClientInvitation(
            id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            trainer_id=TRAINER_ID,
            client_id=OTHER_CLIENT_ID,
            status=InvitationStatus.ACCEPTED.value,
        )
        session.add_all([invitation, other_invitation])
        await session.flush()

        relationship = TrainerClientRelationship(
            id=RELATIONSHIP_ID,
            trainer_id=TRAINER_ID,
            client_id=CLIENT_ID,
            invitation_id=invitation.id,
            status=RelationshipStatus.ACTIVE.value,
        )
        other_relationship = TrainerClientRelationship(
            id=OTHER_RELATIONSHIP_ID,
            trainer_id=TRAINER_ID,
            client_id=OTHER_CLIENT_ID,
            invitation_id=other_invitation.id,
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
            description="Frozen read snapshot",
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
        session.add_all([relationship, other_relationship, exercise, workout])
        await session.commit()


def payload(
    client_id: str,
    request_id: str,
    scheduled_date: date = TARGET_DATE,
) -> CreateWorkoutAssignmentRequest:
    return CreateWorkoutAssignmentRequest(
        client_id=client_id,
        workout_id=WORKOUT_ID,
        scheduled_date=scheduled_date,
        request_id=request_id,
    )


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


async def create_assignment(
    factory: async_sessionmaker[AsyncSession],
    *,
    client_id: str,
    request_id: str,
    scheduled_date: date = TARGET_DATE,
) -> str:
    async with factory() as session:
        result = await assignment_service.create_assignment(
            session,
            TRAINER_ID,
            payload(client_id, request_id, scheduled_date),
        )
        return result.assignment.id


async def test_get_by_id_allows_assignment_parties_after_relationship_termination(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_sources(p0_session_factory)
    assignment_id = await create_assignment(
        p0_session_factory,
        client_id=CLIENT_ID,
        request_id="historical-get",
    )
    async with p0_session_factory() as session:
        await clients_service.terminate_relationship(session, TRAINER_ID, RELATIONSHIP_ID)

    for actor_id, role in ((TRAINER_ID, "trainer"), (CLIENT_ID, "client")):
        async with http_client(p0_session_factory, actor_id, role) as client:
            response = await client.get(f"/assignments/{assignment_id}")
        assert response.status_code == 200
        body = response.json()
        assert body["id"] == assignment_id
        assert body["status"] == WorkoutAssignmentStatus.CANCELLED.value
        assert body["workout_snapshot"]["title"] == "Leg day"
        assert body["workout_snapshot"]["description"] == "Frozen read snapshot"

    async with http_client(p0_session_factory, OTHER_CLIENT_ID, "client") as client:
        forbidden = await client.get(f"/assignments/{assignment_id}")
    assert forbidden.status_code == 403
    assert forbidden.json()["detail"]["code"] == "ASSIGNMENT_PARTY_REQUIRED"


async def test_get_by_id_missing_assignment_returns_typed_404(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with http_client(p0_session_factory, CLIENT_ID, "client") as client:
        response = await client.get(
            "/assignments/ffffffff-ffff-ffff-ffff-ffffffffffff"
        )
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "ASSIGNMENT_NOT_FOUND"


async def test_client_date_list_is_exact_scoped_and_returns_all_statuses(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_sources(p0_session_factory)
    own_ids = [
        await create_assignment(
            p0_session_factory,
            client_id=CLIENT_ID,
            request_id=f"own-{index}",
        )
        for index in range(4)
    ]
    await create_assignment(
        p0_session_factory,
        client_id=CLIENT_ID,
        request_id="other-date",
        scheduled_date=date(2026, 8, 26),
    )
    await create_assignment(
        p0_session_factory,
        client_id=OTHER_CLIENT_ID,
        request_id="other-client",
    )

    statuses = [
        WorkoutAssignmentStatus.PLANNED.value,
        WorkoutAssignmentStatus.IN_PROGRESS.value,
        WorkoutAssignmentStatus.COMPLETED.value,
        WorkoutAssignmentStatus.CANCELLED.value,
    ]
    async with p0_session_factory() as session:
        for assignment_id, assignment_status in zip(own_ids, statuses, strict=True):
            assignment = await session.get(WorkoutAssignment, assignment_id)
            assert assignment is not None
            assignment.status = assignment_status
        await session.commit()

    async with http_client(p0_session_factory, CLIENT_ID, "client") as client:
        response = await client.get(
            "/assignments",
            params={"scheduled_date": TARGET_DATE.isoformat()},
        )
        empty = await client.get(
            "/assignments",
            params={"scheduled_date": "2026-08-27"},
        )
        missing_date = await client.get("/assignments")

    assert response.status_code == 200
    rows = response.json()
    assert {row["id"] for row in rows} == set(own_ids)
    assert {row["status"] for row in rows} == set(statuses)
    assert all(row["client_id"] == CLIENT_ID for row in rows)
    assert all(row["scheduled_date"] == TARGET_DATE.isoformat() for row in rows)
    assert all(row["workout_snapshot"]["title"] == "Leg day" for row in rows)
    assert empty.status_code == 200
    assert empty.json() == []
    assert missing_date.status_code == 422

    async with http_client(p0_session_factory, TRAINER_ID, "trainer") as client:
        forbidden = await client.get(
            "/assignments",
            params={"scheduled_date": TARGET_DATE.isoformat()},
        )
    assert forbidden.status_code == 403
    assert forbidden.json()["detail"]["code"] == "ROLE_NOT_ALLOWED"


async def test_read_side_openapi_uses_existing_assignment_response_schema() -> None:
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    schema = app.openapi()

    get_operation = schema["paths"]["/api/v1/assignments/{assignment_id}"]["get"]
    assert get_operation["operationId"] == "getWorkoutAssignment"
    assert get_operation["responses"]["200"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/WorkoutAssignmentResponse"
    }

    list_operation = schema["paths"]["/api/v1/assignments"]["get"]
    assert list_operation["operationId"] == "listClientWorkoutAssignmentsByDate"
    scheduled_date = next(
        parameter
        for parameter in list_operation["parameters"]
        if parameter["name"] == "scheduled_date"
    )
    assert scheduled_date["required"] is True
    assert scheduled_date["schema"]["format"] == "date"
    assert list_operation["responses"]["200"]["content"]["application/json"]["schema"] == {
        "items": {"$ref": "#/components/schemas/WorkoutAssignmentResponse"},
        "type": "array",
        "title": "Response List Client Workout Assignments By Date Api V1 Assignments Get",
    }
