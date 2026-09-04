from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, date, datetime

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from toptrainers_api.core.auth import current_account
from toptrainers_api.core.db import get_session
from toptrainers_api.modules.assignments import service as assignment_service
from toptrainers_api.modules.assignments.models import (
    WorkoutAssignment,
    WorkoutAssignmentStatus,
    WorkoutExecution,
)
from toptrainers_api.modules.assignments.router import router
from toptrainers_api.modules.clients import service as clients_service
from toptrainers_api.modules.clients.models import (
    InvitationStatus,
    RelationshipStatus,
    TrainerClientInvitation,
    TrainerClientRelationship,
)
from toptrainers_api.modules.identity.models import Account
from toptrainers_api.modules.workouts.models import Workout

pytestmark = pytest.mark.asyncio

TRAINER_ID = "11111111-1111-1111-1111-111111111111"
CLIENT_ID = "22222222-2222-2222-2222-222222222222"
OTHER_TRAINER_ID = "33333333-3333-3333-3333-333333333333"
OTHER_CLIENT_ID = "44444444-4444-4444-4444-444444444444"
RELATIONSHIP_ID = "55555555-5555-5555-5555-555555555555"
WORKOUT_ID = "66666666-6666-6666-6666-666666666666"
ASSIGNMENT_ID = "77777777-7777-7777-7777-777777777777"
EXECUTION_ID = "88888888-8888-8888-8888-888888888888"
SOURCE_EXERCISE_ID = "99999999-9999-9999-9999-999999999999"
STARTED_AT = datetime(2026, 9, 4, 10, 0, tzinfo=UTC)


def frozen_snapshot() -> dict[str, object]:
    exercise_common: dict[str, object] = {
        "source_exercise_id": SOURCE_EXERCISE_ID,
        "title": "Frozen squat",
        "direction": "strength",
        "muscle_group": "legs",
        "instruction": "Frozen instruction",
        "reference_url": None,
        "video_platform": None,
        "video_url": None,
        "video_file_url": None,
        "thumbnail_url": None,
        "weight_kg": 40.0,
        "reps": 8,
    }
    return {
        "title": "Frozen workout title",
        "description": "Frozen description",
        "blocks": [
            {
                "kind": "main",
                "position": 0,
                "exercises": [
                    {**exercise_common, "position": 0, "sets": 2},
                    {**exercise_common, "position": 1, "sets": 1},
                ],
            }
        ],
    }


async def seed_execution(factory: async_sessionmaker[AsyncSession]) -> None:
    async with factory() as session:
        session.add_all(
            [
                Account(
                    id=TRAINER_ID,
                    email="results-trainer@example.test",
                    password_hash="test",
                    role="trainer",
                ),
                Account(
                    id=CLIENT_ID,
                    email="results-client@example.test",
                    password_hash="test",
                    role="client",
                ),
                Account(
                    id=OTHER_TRAINER_ID,
                    email="results-other-trainer@example.test",
                    password_hash="test",
                    role="trainer",
                ),
                Account(
                    id=OTHER_CLIENT_ID,
                    email="results-other-client@example.test",
                    password_hash="test",
                    role="client",
                ),
            ]
        )
        await session.flush()

        invitation = TrainerClientInvitation(
            id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
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
        # Deliberately keep the current Workout empty. Result mapping must come
        # from the frozen Assignment snapshot rather than the live template.
        workout = Workout(
            id=WORKOUT_ID,
            trainer_id=TRAINER_ID,
            title="Current workout changed after assignment",
            description="Current mutable template",
        )
        assignment = WorkoutAssignment(
            id=ASSIGNMENT_ID,
            relationship_id=RELATIONSHIP_ID,
            source_workout_id=WORKOUT_ID,
            request_id="results-v1",
            workout_snapshot=frozen_snapshot(),
            snapshot_schema_version=1,
            scheduled_date=date(2026, 9, 4),
            status=WorkoutAssignmentStatus.IN_PROGRESS.value,
        )
        execution = WorkoutExecution(
            id=EXECUTION_ID,
            assignment_id=ASSIGNMENT_ID,
            started_at=STARTED_AT,
            completed_at=None,
        )
        session.add_all([relationship, workout])
        await session.flush()
        session.add(assignment)
        await session.flush()
        session.add(execution)
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
        return {"sub": actor_id, "role": role, "sid": "results-test"}

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session

    app.dependency_overrides[current_account] = override_current_account
    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


def result_path(block: int, exercise: int, set_index: int) -> str:
    return (
        f"/assignments/{ASSIGNMENT_ID}/execution/results/"
        f"{block}/{exercise}/{set_index}"
    )


def list_path() -> str:
    return f"/assignments/{ASSIGNMENT_ID}/execution/results"


async def test_duplicate_source_occurrences_are_independent_and_partial_values_work(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_execution(p0_session_factory)
    async with http_client(p0_session_factory, CLIENT_ID, "client") as client:
        reps_only = await client.put(result_path(0, 0, 0), json={"actual_reps": 0})
        assert reps_only.status_code == 200
        assert reps_only.json()["actual_reps"] == 0
        assert reps_only.json()["actual_weight_kg"] is None

        weight_only = await client.put(
            result_path(0, 1, 0),
            json={"actual_weight_kg": 42.5},
        )
        assert weight_only.status_code == 200
        assert weight_only.json()["actual_reps"] is None
        assert weight_only.json()["actual_weight_kg"] == 42.5

        listed = await client.get(list_path())
    assert listed.status_code == 200
    assert [
        (item["block_position"], item["exercise_position"], item["set_index"])
        for item in listed.json()
    ] == [(0, 0, 0), (0, 1, 0)]
    assert all("source_exercise_id" not in item for item in listed.json())


@pytest.mark.parametrize(
    "block_position,exercise_position,set_index",
    [(1, 0, 0), (0, 2, 0), (0, 0, 2)],
)
async def test_positive_but_missing_frozen_coordinate_returns_404(
    p0_session_factory: async_sessionmaker[AsyncSession],
    block_position: int,
    exercise_position: int,
    set_index: int,
) -> None:
    await seed_execution(p0_session_factory)
    async with http_client(p0_session_factory, CLIENT_ID, "client") as client:
        response = await client.put(
            result_path(block_position, exercise_position, set_index),
            json={"actual_reps": 8},
        )
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "RESULT_COORDINATE_NOT_FOUND"


async def test_negative_coordinate_and_empty_actual_payload_are_validation_errors(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_execution(p0_session_factory)
    async with http_client(p0_session_factory, CLIENT_ID, "client") as client:
        negative = await client.put(result_path(-1, 0, 0), json={"actual_reps": 8})
        empty = await client.put(
            result_path(0, 0, 0),
            json={"actual_reps": None, "actual_weight_kg": None},
        )
    assert negative.status_code == 422
    assert empty.status_code == 422


async def test_correction_works_in_progress_and_after_completion_without_lifecycle_change(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_execution(p0_session_factory)
    async with http_client(p0_session_factory, CLIENT_ID, "client") as client:
        first = await client.put(result_path(0, 0, 0), json={"actual_reps": 8})
        corrected = await client.put(result_path(0, 0, 0), json={"actual_reps": 9})
    assert first.status_code == 200
    assert corrected.status_code == 200
    assert corrected.json()["actual_reps"] == 9

    async with p0_session_factory() as session:
        completed = await assignment_service.complete_execution(session, CLIENT_ID, ASSIGNMENT_ID)
        original_completed_at = completed.completed_at
        assert original_completed_at is not None

    async with http_client(p0_session_factory, CLIENT_ID, "client") as client:
        after_complete = await client.put(
            result_path(0, 0, 0),
            json={"actual_reps": 10, "actual_weight_kg": 50.0},
        )
        listed = await client.get(list_path())
    assert after_complete.status_code == 200
    assert listed.status_code == 200
    assert listed.json()[0]["actual_reps"] == 10
    assert listed.json()[0]["actual_weight_kg"] == 50.0

    async with p0_session_factory() as session:
        assignment = await session.get(WorkoutAssignment, ASSIGNMENT_ID)
        execution = await session.get(WorkoutExecution, EXECUTION_ID)
        assert assignment is not None
        assert execution is not None
        assert assignment.status == WorkoutAssignmentStatus.COMPLETED.value
        assert execution.completed_at == original_completed_at


async def test_correction_after_relationship_termination_is_allowed(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_execution(p0_session_factory)
    async with p0_session_factory() as session:
        await assignment_service.complete_execution(session, CLIENT_ID, ASSIGNMENT_ID)
    async with p0_session_factory() as session:
        await clients_service.terminate_relationship(session, CLIENT_ID, RELATIONSHIP_ID)

    async with http_client(p0_session_factory, CLIENT_ID, "client") as client:
        correction = await client.put(result_path(0, 0, 0), json={"actual_reps": 12})
    assert correction.status_code == 200
    assert correction.json()["actual_reps"] == 12


async def test_completion_with_zero_results_is_still_valid(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_execution(p0_session_factory)
    async with p0_session_factory() as session:
        completed = await assignment_service.complete_execution(session, CLIENT_ID, ASSIGNMENT_ID)
        assert completed.completed_at is not None

    async with http_client(p0_session_factory, CLIENT_ID, "client") as client:
        listed = await client.get(list_path())
    assert listed.status_code == 200
    assert listed.json() == []


async def test_repeated_identical_put_keeps_one_resource_and_delete_is_idempotent(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_execution(p0_session_factory)
    payload = {"actual_reps": 8, "actual_weight_kg": 40.0}
    async with http_client(p0_session_factory, CLIENT_ID, "client") as client:
        first = await client.put(result_path(0, 0, 0), json=payload)
        second = await client.put(result_path(0, 0, 0), json=payload)
        listed = await client.get(list_path())
        deleted = await client.delete(result_path(0, 0, 0))
        after_delete = await client.get(list_path())
        repeated_delete = await client.delete(result_path(0, 0, 0))
    assert first.status_code == 200
    assert second.status_code == 200
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert deleted.status_code == 204
    assert after_delete.json() == []
    assert repeated_delete.status_code == 204


async def test_trainer_is_read_only_and_completed_historical_read_survives_termination(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_execution(p0_session_factory)
    async with http_client(p0_session_factory, TRAINER_ID, "trainer") as trainer:
        put_forbidden = await trainer.put(result_path(0, 0, 0), json={"actual_reps": 8})
        delete_forbidden = await trainer.delete(result_path(0, 0, 0))
        before_complete = await trainer.get(list_path())
    assert put_forbidden.status_code == 403
    assert delete_forbidden.status_code == 403
    assert before_complete.status_code == 409
    assert before_complete.json()["detail"]["code"] == "EXECUTION_NOT_COMPLETED"

    async with http_client(p0_session_factory, CLIENT_ID, "client") as client:
        saved = await client.put(result_path(0, 0, 0), json={"actual_reps": 8})
    assert saved.status_code == 200
    async with p0_session_factory() as session:
        await assignment_service.complete_execution(session, CLIENT_ID, ASSIGNMENT_ID)
    async with p0_session_factory() as session:
        await clients_service.terminate_relationship(session, TRAINER_ID, RELATIONSHIP_ID)

    async with http_client(p0_session_factory, TRAINER_ID, "trainer") as trainer:
        historical = await trainer.get(list_path())
    assert historical.status_code == 200
    assert historical.json()[0]["actual_reps"] == 8


@pytest.mark.parametrize(
    "actor_id,role",
    [(OTHER_TRAINER_ID, "trainer"), (OTHER_CLIENT_ID, "client")],
)
async def test_foreign_trainer_and_client_are_hidden(
    p0_session_factory: async_sessionmaker[AsyncSession],
    actor_id: str,
    role: str,
) -> None:
    await seed_execution(p0_session_factory)
    async with http_client(p0_session_factory, actor_id, role) as client:
        response = await client.get(list_path())
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "ASSIGNMENT_NOT_FOUND"


async def test_current_workout_content_is_not_used_for_result_coordinate_mapping(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_execution(p0_session_factory)
    # The live Workout has no blocks, while the frozen Assignment snapshot has two occurrences.
    async with http_client(p0_session_factory, CLIENT_ID, "client") as client:
        response = await client.put(result_path(0, 1, 0), json={"actual_reps": 7})
    assert response.status_code == 200
    assert response.json()["exercise_position"] == 1
