from __future__ import annotations

import asyncio
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from toptrainers_api.core.errors import BusinessRuleError
from toptrainers_api.modules.assignments import service as assignment_service
from toptrainers_api.modules.assignments.models import WorkoutAssignment, WorkoutAssignmentStatus
from toptrainers_api.modules.assignments.schemas import (
    CreateWorkoutAssignmentRequest,
    RescheduleWorkoutAssignmentRequest,
)
from toptrainers_api.modules.clients import repository as clients_repository
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
RELATIONSHIP_ID = "44444444-4444-4444-4444-444444444444"
WORKOUT_ID = "55555555-5555-5555-5555-555555555555"
EXERCISE_ID = "66666666-6666-6666-6666-666666666666"


async def seed_sources(factory: async_sessionmaker[AsyncSession]) -> None:
    async with factory() as session:
        session.add_all(
            [
                Account(
                    id=TRAINER_ID,
                    email="trainer-race@example.test",
                    password_hash="test",
                    role="trainer",
                ),
                Account(
                    id=CLIENT_ID,
                    email="client-race@example.test",
                    password_hash="test",
                    role="client",
                ),
            ]
        )
        invitation = TrainerClientInvitation(
            id="77777777-7777-7777-7777-777777777777",
            trainer_id=TRAINER_ID,
            client_id=CLIENT_ID,
            status=InvitationStatus.ACCEPTED.value,
        )
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
        session.add_all([invitation, relationship, exercise, workout])
        await session.commit()


def payload(request_id: str = "race-request") -> CreateWorkoutAssignmentRequest:
    return CreateWorkoutAssignmentRequest(
        client_id=CLIENT_ID,
        workout_id=WORKOUT_ID,
        scheduled_date=date(2026, 8, 25),
        request_id=request_id,
    )


async def test_concurrent_same_request_id_creates_one_assignment(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_sources(p0_session_factory)
    async with p0_session_factory() as first_session, p0_session_factory() as second_session:
        first, second = await asyncio.gather(
            assignment_service.create_assignment(first_session, TRAINER_ID, payload()),
            assignment_service.create_assignment(second_session, TRAINER_ID, payload()),
        )
    assert first.assignment.id == second.assignment.id
    async with p0_session_factory() as session:
        count = await session.scalar(select(func.count()).select_from(WorkoutAssignment))
        assert count == 1


async def test_create_wins_then_termination_cancels_new_planned_assignment(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_sources(p0_session_factory)
    async with p0_session_factory() as create_session, p0_session_factory() as terminate_session:
        assert await clients_repository.lock_account(create_session, CLIENT_ID) is not None
        terminate_task = asyncio.create_task(
            clients_service.terminate_relationship(
                terminate_session,
                TRAINER_ID,
                RELATIONSHIP_ID,
            )
        )
        await asyncio.sleep(0.05)
        created = await assignment_service.create_assignment(
            create_session,
            TRAINER_ID,
            payload("create-wins"),
        )
        await asyncio.wait_for(terminate_task, timeout=3)

    async with p0_session_factory() as session:
        stored = await session.get(WorkoutAssignment, created.assignment.id)
        assert stored is not None
        assert stored.status == WorkoutAssignmentStatus.CANCELLED.value


async def test_termination_wins_then_create_gets_active_relationship_409(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_sources(p0_session_factory)
    async with p0_session_factory() as terminate_session, p0_session_factory() as create_session:
        assert await clients_repository.lock_account(terminate_session, CLIENT_ID) is not None
        create_task = asyncio.create_task(
            assignment_service.create_assignment(
                create_session,
                TRAINER_ID,
                payload("termination-wins"),
            )
        )
        await asyncio.sleep(0.05)
        await clients_service.terminate_relationship(
            terminate_session,
            TRAINER_ID,
            RELATIONSHIP_ID,
        )
        with pytest.raises(BusinessRuleError) as caught:
            await asyncio.wait_for(create_task, timeout=3)
        assert caught.value.code == "ACTIVE_RELATIONSHIP_REQUIRED"

    async with p0_session_factory() as session:
        count = await session.scalar(select(func.count()).select_from(WorkoutAssignment))
        assert count == 0


async def test_termination_wins_reschedule_returns_not_planned(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_sources(p0_session_factory)
    async with p0_session_factory() as session:
        created = await assignment_service.create_assignment(
            session,
            TRAINER_ID,
            payload("reschedule-race"),
        )
        assignment_id = created.assignment.id

    async with p0_session_factory() as terminate_session, p0_session_factory() as mutate_session:
        assert await clients_repository.lock_account(terminate_session, CLIENT_ID) is not None
        mutate_task = asyncio.create_task(
            assignment_service.reschedule_assignment(
                mutate_session,
                TRAINER_ID,
                assignment_id,
                RescheduleWorkoutAssignmentRequest(scheduled_date=date(2026, 8, 28)),
            )
        )
        await asyncio.sleep(0.05)
        await clients_service.terminate_relationship(
            terminate_session,
            TRAINER_ID,
            RELATIONSHIP_ID,
        )
        with pytest.raises(BusinessRuleError) as caught:
            await asyncio.wait_for(mutate_task, timeout=3)
        assert caught.value.code == "ASSIGNMENT_NOT_PLANNED"


async def test_termination_cancels_only_planned_assignments(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_sources(p0_session_factory)
    async with p0_session_factory() as session:
        base_snapshot = {"title": "x", "description": "", "blocks": []}
        assignments = [
            WorkoutAssignment(
                id="a" * 36,
                relationship_id=RELATIONSHIP_ID,
                source_workout_id=WORKOUT_ID,
                request_id="planned",
                workout_snapshot=base_snapshot,
                snapshot_schema_version=1,
                scheduled_date=date(2026, 8, 25),
                status=WorkoutAssignmentStatus.PLANNED.value,
            ),
            WorkoutAssignment(
                id="b" * 36,
                relationship_id=RELATIONSHIP_ID,
                source_workout_id=WORKOUT_ID,
                request_id="in-progress",
                workout_snapshot=base_snapshot,
                snapshot_schema_version=1,
                scheduled_date=date(2026, 8, 25),
                status=WorkoutAssignmentStatus.IN_PROGRESS.value,
            ),
            WorkoutAssignment(
                id="c" * 36,
                relationship_id=RELATIONSHIP_ID,
                source_workout_id=WORKOUT_ID,
                request_id="completed",
                workout_snapshot=base_snapshot,
                snapshot_schema_version=1,
                scheduled_date=date(2026, 8, 25),
                status=WorkoutAssignmentStatus.COMPLETED.value,
            ),
        ]
        session.add_all(assignments)
        await session.commit()
        await clients_service.terminate_relationship(session, TRAINER_ID, RELATIONSHIP_ID)
        for assignment in assignments:
            await session.refresh(assignment)
        assert assignments[0].status == WorkoutAssignmentStatus.CANCELLED.value
        assert assignments[1].status == WorkoutAssignmentStatus.IN_PROGRESS.value
        assert assignments[2].status == WorkoutAssignmentStatus.COMPLETED.value
