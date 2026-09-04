from __future__ import annotations

import asyncio
from datetime import UTC, date, datetime

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from toptrainers_api.modules.assignments.models import (
    WorkoutAssignment,
    WorkoutAssignmentStatus,
    WorkoutExecution,
)
from toptrainers_api.modules.clients import repository as clients_repository
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
RELATIONSHIP_ID = "33333333-3333-3333-3333-333333333333"
WORKOUT_ID = "44444444-4444-4444-4444-444444444444"
ASSIGNMENT_ID = "55555555-5555-5555-5555-555555555555"
EXECUTION_ID = "66666666-6666-6666-6666-666666666666"
SOURCE_EXERCISE_ID = "77777777-7777-7777-7777-777777777777"


def snapshot() -> dict[str, object]:
    return {
        "title": "Race workout",
        "description": "",
        "blocks": [
            {
                "kind": "main",
                "position": 0,
                "exercises": [
                    {
                        "source_exercise_id": SOURCE_EXERCISE_ID,
                        "position": 0,
                        "title": "Squat",
                        "direction": "strength",
                        "muscle_group": "legs",
                        "instruction": "Stable",
                        "reference_url": None,
                        "video_platform": None,
                        "video_url": None,
                        "video_file_url": None,
                        "thumbnail_url": None,
                        "weight_kg": 40.0,
                        "sets": 1,
                        "reps": 8,
                    }
                ],
            }
        ],
    }


async def seed(factory: async_sessionmaker[AsyncSession]) -> None:
    async with factory() as session:
        session.add_all(
            [
                Account(
                    id=TRAINER_ID,
                    email="results-race-trainer@example.test",
                    password_hash="test",
                    role="trainer",
                ),
                Account(
                    id=CLIENT_ID,
                    email="results-race-client@example.test",
                    password_hash="test",
                    role="client",
                ),
            ]
        )
        await session.flush()
        invitation = TrainerClientInvitation(
            id="88888888-8888-8888-8888-888888888888",
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
        workout = Workout(
            id=WORKOUT_ID,
            trainer_id=TRAINER_ID,
            title="Current",
            description="",
        )
        session.add_all([relationship, workout])
        await session.flush()

        assignment = WorkoutAssignment(
            id=ASSIGNMENT_ID,
            relationship_id=RELATIONSHIP_ID,
            source_workout_id=WORKOUT_ID,
            request_id="results-race",
            workout_snapshot=snapshot(),
            snapshot_schema_version=1,
            scheduled_date=date(2026, 9, 4),
            status=WorkoutAssignmentStatus.IN_PROGRESS.value,
        )
        session.add(assignment)
        await session.flush()

        session.add(
            WorkoutExecution(
                id=EXECUTION_ID,
                assignment_id=ASSIGNMENT_ID,
                started_at=datetime(2026, 9, 4, 10, 0, tzinfo=UTC),
                completed_at=None,
            )
        )
        await session.commit()


async def release_gate(session: AsyncSession) -> None:
    await session.rollback()


async def stored_result(factory: async_sessionmaker[AsyncSession]) -> tuple[int, int | None]:
    async with factory() as session:
        row = (
            await session.execute(
                text(
                    "SELECT COUNT(*) AS count, MAX(actual_reps) AS actual_reps "
                    "FROM workout_execution_set_results "
                    "WHERE execution_id = :execution_id AND block_position = 0 "
                    "AND exercise_position = 0 AND set_index = 0"
                ),
                {"execution_id": EXECUTION_ID},
            )
        ).one()
        return int(row.count), row.actual_reps


async def test_concurrent_first_put_creates_one_natural_key_resource(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed(p0_session_factory)
    from toptrainers_api.modules.assignments import results_service
    from toptrainers_api.modules.assignments.schemas import WorkoutExecutionSetResultUpsertRequest

    async with (
        p0_session_factory() as gate_session,
        p0_session_factory() as first_session,
        p0_session_factory() as second_session,
    ):
        assert await clients_repository.lock_account(gate_session, CLIENT_ID) is not None
        first = asyncio.create_task(
            results_service.put_result(
                first_session,
                CLIENT_ID,
                ASSIGNMENT_ID,
                0,
                0,
                0,
                WorkoutExecutionSetResultUpsertRequest(actual_reps=8),
            )
        )
        await asyncio.sleep(0.05)
        assert not first.done()
        second = asyncio.create_task(
            results_service.put_result(
                second_session,
                CLIENT_ID,
                ASSIGNMENT_ID,
                0,
                0,
                0,
                WorkoutExecutionSetResultUpsertRequest(actual_reps=9),
            )
        )
        await asyncio.sleep(0.05)
        assert not second.done()
        await release_gate(gate_session)
        await asyncio.wait_for(first, timeout=3)
        await asyncio.wait_for(second, timeout=3)

    count, actual_reps = await stored_result(p0_session_factory)
    assert count == 1
    assert actual_reps == 9


async def test_concurrent_corrections_are_last_committed_wins(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed(p0_session_factory)
    from toptrainers_api.modules.assignments import results_service
    from toptrainers_api.modules.assignments.schemas import WorkoutExecutionSetResultUpsertRequest

    async with p0_session_factory() as session:
        await results_service.put_result(
            session,
            CLIENT_ID,
            ASSIGNMENT_ID,
            0,
            0,
            0,
            WorkoutExecutionSetResultUpsertRequest(actual_reps=7),
        )

    async with (
        p0_session_factory() as gate_session,
        p0_session_factory() as first_session,
        p0_session_factory() as second_session,
    ):
        assert await clients_repository.lock_account(gate_session, CLIENT_ID) is not None
        first = asyncio.create_task(
            results_service.put_result(
                first_session,
                CLIENT_ID,
                ASSIGNMENT_ID,
                0,
                0,
                0,
                WorkoutExecutionSetResultUpsertRequest(actual_reps=10),
            )
        )
        await asyncio.sleep(0.05)
        assert not first.done()
        second = asyncio.create_task(
            results_service.put_result(
                second_session,
                CLIENT_ID,
                ASSIGNMENT_ID,
                0,
                0,
                0,
                WorkoutExecutionSetResultUpsertRequest(actual_reps=12),
            )
        )
        await asyncio.sleep(0.05)
        assert not second.done()
        await release_gate(gate_session)
        await asyncio.wait_for(first, timeout=3)
        await asyncio.wait_for(second, timeout=3)

    count, actual_reps = await stored_result(p0_session_factory)
    assert count == 1
    assert actual_reps == 12
