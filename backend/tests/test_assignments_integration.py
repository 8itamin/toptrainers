from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from toptrainers_api.core.errors import BusinessRuleError
from toptrainers_api.modules.assignments import service
from toptrainers_api.modules.assignments.models import WorkoutAssignment
from toptrainers_api.modules.assignments.schemas import (
    CreateWorkoutAssignmentRequest,
    RescheduleWorkoutAssignmentRequest,
)
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
OTHER_TRAINER_ID = "33333333-3333-3333-3333-333333333333"
RELATIONSHIP_ID = "44444444-4444-4444-4444-444444444444"
WORKOUT_ID = "55555555-5555-5555-5555-555555555555"
EXERCISE_ID = "66666666-6666-6666-6666-666666666666"


async def seed_assignment_sources(
    factory: async_sessionmaker[AsyncSession],
    *,
    relationship_status: str = RelationshipStatus.ACTIVE.value,
) -> None:
    async with factory() as session:
        session.add_all(
            [
                Account(
                    id=TRAINER_ID,
                    email="trainer@example.test",
                    password_hash="test",
                    role="trainer",
                ),
                Account(
                    id=CLIENT_ID,
                    email="client@example.test",
                    password_hash="test",
                    role="client",
                ),
                Account(
                    id=OTHER_TRAINER_ID,
                    email="other@example.test",
                    password_hash="test",
                    role="trainer",
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
            status=relationship_status,
        )
        exercise = Exercise(
            id=EXERCISE_ID,
            trainer_id=TRAINER_ID,
            title="Squat",
            direction="strength",
            muscle_group="legs",
            instruction="Neutral back",
            reference_url="https://example.test/ref",
            video_platform="youtube",
            video_url="https://example.test/video",
            video_file_url=None,
            thumbnail_url="https://example.test/thumb",
        )
        workout = Workout(
            id=WORKOUT_ID,
            trainer_id=TRAINER_ID,
            title="Leg day",
            description="Heavy session",
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
                weight_kg=Decimal("50.50"),
                sets=4,
                reps=10,
            )
        )
        workout.blocks.append(block)
        session.add_all([invitation, relationship, exercise, workout])
        await session.commit()


def create_payload(
    *,
    request_id: str = "req-1",
    scheduled_date: date = date(2026, 8, 25),
    workout_id: str = WORKOUT_ID,
) -> CreateWorkoutAssignmentRequest:
    return CreateWorkoutAssignmentRequest(
        client_id=CLIENT_ID,
        workout_id=workout_id,
        scheduled_date=scheduled_date,
        request_id=request_id,
    )


async def test_create_is_idempotent_and_snapshot_remains_frozen(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_assignment_sources(p0_session_factory)
    async with p0_session_factory() as session:
        first = await service.create_assignment(session, TRAINER_ID, create_payload())
        second = await service.create_assignment(session, TRAINER_ID, create_payload())
        assert first.assignment.id == second.assignment.id
        assert first.assignment.workout_snapshot["title"] == "Leg day"
        assert first.assignment.workout_snapshot["blocks"][0]["exercises"][0]["title"] == "Squat"

        workout = await session.get(Workout, WORKOUT_ID)
        exercise = await session.get(Exercise, EXERCISE_ID)
        assert workout is not None and exercise is not None
        workout.title = "Changed live workout"
        exercise.title = "Changed live exercise"
        await session.commit()

        stored = await session.get(WorkoutAssignment, first.assignment.id)
        assert stored is not None
        assert stored.workout_snapshot["title"] == "Leg day"
        assert stored.workout_snapshot["blocks"][0]["exercises"][0]["title"] == "Squat"


async def test_same_payload_with_different_request_ids_creates_two_assignments(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_assignment_sources(p0_session_factory)
    async with p0_session_factory() as session:
        first = await service.create_assignment(
            session,
            TRAINER_ID,
            create_payload(request_id="req-1"),
        )
        second = await service.create_assignment(
            session,
            TRAINER_ID,
            create_payload(request_id="req-2"),
        )
        assert first.assignment.id != second.assignment.id
        count = await session.scalar(select(func.count()).select_from(WorkoutAssignment))
        assert count == 2


async def test_same_request_id_with_changed_payload_returns_409(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_assignment_sources(p0_session_factory)
    async with p0_session_factory() as session:
        await service.create_assignment(session, TRAINER_ID, create_payload())
        with pytest.raises(BusinessRuleError) as caught:
            await service.create_assignment(
                session,
                TRAINER_ID,
                create_payload(scheduled_date=date(2026, 8, 26)),
            )
        assert caught.value.status_code == 409
        assert caught.value.code == "ASSIGNMENT_REQUEST_ID_CONFLICT"


async def test_create_requires_active_relationship(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_assignment_sources(
        p0_session_factory,
        relationship_status=RelationshipStatus.TERMINATED.value,
    )
    async with p0_session_factory() as session:
        with pytest.raises(BusinessRuleError) as caught:
            await service.create_assignment(session, TRAINER_ID, create_payload())
        assert caught.value.status_code == 409
        assert caught.value.code == "ACTIVE_RELATIONSHIP_REQUIRED"


async def test_create_does_not_expose_other_trainers_workout(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_assignment_sources(p0_session_factory)
    other_workout_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    async with p0_session_factory() as session:
        session.add(
            Workout(
                id=other_workout_id,
                trainer_id=OTHER_TRAINER_ID,
                title="Private",
                description="",
            )
        )
        await session.commit()
        with pytest.raises(BusinessRuleError) as caught:
            await service.create_assignment(
                session,
                TRAINER_ID,
                create_payload(workout_id=other_workout_id),
            )
        assert caught.value.status_code == 404
        assert caught.value.code == "WORKOUT_NOT_FOUND"


async def test_only_planned_assignment_can_be_rescheduled_or_cancelled(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_assignment_sources(p0_session_factory)
    async with p0_session_factory() as session:
        result = await service.create_assignment(session, TRAINER_ID, create_payload())
        result = await service.reschedule_assignment(
            session,
            TRAINER_ID,
            result.assignment.id,
            RescheduleWorkoutAssignmentRequest(scheduled_date=date(2026, 8, 27)),
        )
        assert result.assignment.scheduled_date == date(2026, 8, 27)
        result = await service.cancel_assignment(session, TRAINER_ID, result.assignment.id)
        assert result.assignment.status == "CANCELLED"
        with pytest.raises(BusinessRuleError) as caught:
            await service.cancel_assignment(session, TRAINER_ID, result.assignment.id)
        assert caught.value.code == "ASSIGNMENT_NOT_PLANNED"


async def test_foreign_trainer_cannot_mutate_assignment(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_assignment_sources(p0_session_factory)
    async with p0_session_factory() as session:
        result = await service.create_assignment(session, TRAINER_ID, create_payload())
        with pytest.raises(BusinessRuleError) as caught:
            await service.cancel_assignment(session, OTHER_TRAINER_ID, result.assignment.id)
        assert caught.value.status_code == 403
        assert caught.value.code == "ASSIGNMENT_TRAINER_REQUIRED"
