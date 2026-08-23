from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from toptrainers_api.core.errors import BusinessRuleError
from toptrainers_api.modules.assignments import service as assignment_service
from toptrainers_api.modules.assignments.models import WorkoutAssignment, WorkoutAssignmentStatus
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
RELATIONSHIP_ID = "44444444-4444-4444-4444-444444444444"
WORKOUT_ID = "55555555-5555-5555-5555-555555555555"
EXERCISE_ID = "66666666-6666-6666-6666-666666666666"


async def seed_sources(factory: async_sessionmaker[AsyncSession]) -> None:
    async with factory() as session:
        session.add_all(
            [
                Account(
                    id=TRAINER_ID,
                    email="trainer-execution@example.test",
                    password_hash="test",
                    role="trainer",
                ),
                Account(
                    id=CLIENT_ID,
                    email="client-execution@example.test",
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


async def create_assignment(factory: async_sessionmaker[AsyncSession]) -> str:
    async with factory() as session:
        result = await assignment_service.create_assignment(
            session,
            TRAINER_ID,
            CreateWorkoutAssignmentRequest(
                client_id=CLIENT_ID,
                workout_id=WORKOUT_ID,
                scheduled_date=date(2026, 8, 25),
                request_id="execution-integration",
            ),
        )
        return result.assignment.id


async def test_start_get_complete_and_retries_are_authoritative(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_sources(p0_session_factory)
    assignment_id = await create_assignment(p0_session_factory)

    async with p0_session_factory() as session:
        started = await assignment_service.start_execution(session, CLIENT_ID, assignment_id)
        started_at = started.started_at
        repeated_start = await assignment_service.start_execution(session, CLIENT_ID, assignment_id)
        assert repeated_start.id == started.id
        assert repeated_start.started_at == started_at

        trainer_read = await assignment_service.get_execution(session, TRAINER_ID, assignment_id)
        client_read = await assignment_service.get_execution(session, CLIENT_ID, assignment_id)
        assert trainer_read.id == started.id
        assert client_read.id == started.id

    async with p0_session_factory() as session:
        assignment = await session.get(WorkoutAssignment, assignment_id)
        assert assignment is not None
        assert assignment.status == WorkoutAssignmentStatus.IN_PROGRESS.value

    async with p0_session_factory() as session:
        await clients_service.terminate_relationship(session, CLIENT_ID, RELATIONSHIP_ID)

    async with p0_session_factory() as session:
        completed = await assignment_service.complete_execution(session, CLIENT_ID, assignment_id)
        completed_at = completed.completed_at
        assert completed_at is not None
        repeated_complete = await assignment_service.complete_execution(
            session,
            CLIENT_ID,
            assignment_id,
        )
        assert repeated_complete.id == completed.id
        assert repeated_complete.completed_at == completed_at

    async with p0_session_factory() as session:
        historical = await assignment_service.get_execution(session, TRAINER_ID, assignment_id)
        assignment = await session.get(WorkoutAssignment, assignment_id)
        assert historical.completed_at == completed_at
        assert assignment is not None
        assert assignment.status == WorkoutAssignmentStatus.COMPLETED.value


async def test_execution_business_conflicts(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_sources(p0_session_factory)
    assignment_id = await create_assignment(p0_session_factory)

    async with p0_session_factory() as session:
        with pytest.raises(BusinessRuleError) as missing_execution:
            await assignment_service.get_execution(session, CLIENT_ID, assignment_id)
        assert missing_execution.value.code == "EXECUTION_NOT_FOUND"

        with pytest.raises(BusinessRuleError) as before_start:
            await assignment_service.complete_execution(session, CLIENT_ID, assignment_id)
        assert before_start.value.code == "EXECUTION_NOT_STARTED"

    async with p0_session_factory() as session:
        await clients_service.terminate_relationship(session, CLIENT_ID, RELATIONSHIP_ID)

    async with p0_session_factory() as session:
        with pytest.raises(BusinessRuleError) as inactive:
            await assignment_service.start_execution(session, CLIENT_ID, assignment_id)
        assert inactive.value.code == "ACTIVE_RELATIONSHIP_REQUIRED"
