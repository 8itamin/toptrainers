from __future__ import annotations

import asyncio
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from toptrainers_api.core.errors import BusinessRuleError
from toptrainers_api.modules.assignments import service as assignment_service
from toptrainers_api.modules.assignments.models import (
    WorkoutAssignment,
    WorkoutAssignmentStatus,
    WorkoutExecution,
)
from toptrainers_api.modules.assignments.schemas import CreateWorkoutAssignmentRequest
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
                    email="trainer-execution-race@example.test",
                    password_hash="test",
                    role="trainer",
                ),
                Account(
                    id=CLIENT_ID,
                    email="client-execution-race@example.test",
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


async def create_assignment(factory: async_sessionmaker[AsyncSession], request_id: str) -> str:
    async with factory() as session:
        result = await assignment_service.create_assignment(
            session,
            TRAINER_ID,
            CreateWorkoutAssignmentRequest(
                client_id=CLIENT_ID,
                workout_id=WORKOUT_ID,
                scheduled_date=date(2026, 8, 25),
                request_id=request_id,
            ),
        )
        return result.assignment.id


async def release_gate(session: AsyncSession) -> None:
    await session.rollback()


async def test_double_start_returns_one_execution(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_sources(p0_session_factory)
    assignment_id = await create_assignment(p0_session_factory, "double-start")
    async with p0_session_factory() as first_session, p0_session_factory() as second_session:
        first, second = await asyncio.gather(
            assignment_service.start_execution(first_session, CLIENT_ID, assignment_id),
            assignment_service.start_execution(second_session, CLIENT_ID, assignment_id),
        )
    assert first.id == second.id
    assert first.started_at == second.started_at
    async with p0_session_factory() as session:
        count = await session.scalar(select(func.count()).select_from(WorkoutExecution))
        assignment = await session.get(WorkoutAssignment, assignment_id)
        assert count == 1
        assert assignment is not None
        assert assignment.status == WorkoutAssignmentStatus.IN_PROGRESS.value


async def test_double_complete_preserves_first_timestamp(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_sources(p0_session_factory)
    assignment_id = await create_assignment(p0_session_factory, "double-complete")
    async with p0_session_factory() as session:
        await assignment_service.start_execution(session, CLIENT_ID, assignment_id)
    async with p0_session_factory() as first_session, p0_session_factory() as second_session:
        first, second = await asyncio.gather(
            assignment_service.complete_execution(first_session, CLIENT_ID, assignment_id),
            assignment_service.complete_execution(second_session, CLIENT_ID, assignment_id),
        )
    assert first.id == second.id
    assert first.completed_at is not None
    assert first.completed_at == second.completed_at
    async with p0_session_factory() as session:
        count = await session.scalar(select(func.count()).select_from(WorkoutExecution))
        assignment = await session.get(WorkoutAssignment, assignment_id)
        assert count == 1
        assert assignment is not None
        assert assignment.status == WorkoutAssignmentStatus.COMPLETED.value


async def test_start_wins_then_termination_keeps_assignment_in_progress(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_sources(p0_session_factory)
    assignment_id = await create_assignment(p0_session_factory, "start-wins")
    async with (
        p0_session_factory() as gate_session,
        p0_session_factory() as start_session,
        p0_session_factory() as terminate_session,
    ):
        assert await clients_repository.lock_account(gate_session, CLIENT_ID) is not None
        start_task = asyncio.create_task(
            assignment_service.start_execution(start_session, CLIENT_ID, assignment_id)
        )
        await asyncio.sleep(0.05)
        assert not start_task.done()
        terminate_task = asyncio.create_task(
            clients_service.terminate_relationship(
                terminate_session,
                CLIENT_ID,
                RELATIONSHIP_ID,
            )
        )
        await asyncio.sleep(0.05)
        assert not terminate_task.done()
        await release_gate(gate_session)
        execution = await asyncio.wait_for(start_task, timeout=3)
        await asyncio.wait_for(terminate_task, timeout=3)

    async with p0_session_factory() as session:
        assignment = await session.get(WorkoutAssignment, assignment_id)
        stored_execution = await session.get(WorkoutExecution, execution.id)
        assert assignment is not None
        assert assignment.status == WorkoutAssignmentStatus.IN_PROGRESS.value
        assert stored_execution is not None


async def test_termination_wins_then_start_is_rejected_and_no_execution_exists(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_sources(p0_session_factory)
    assignment_id = await create_assignment(p0_session_factory, "termination-wins")
    async with (
        p0_session_factory() as gate_session,
        p0_session_factory() as terminate_session,
        p0_session_factory() as start_session,
    ):
        assert await clients_repository.lock_account(gate_session, CLIENT_ID) is not None
        terminate_task = asyncio.create_task(
            clients_service.terminate_relationship(
                terminate_session,
                CLIENT_ID,
                RELATIONSHIP_ID,
            )
        )
        await asyncio.sleep(0.05)
        assert not terminate_task.done()
        start_task = asyncio.create_task(
            assignment_service.start_execution(start_session, CLIENT_ID, assignment_id)
        )
        await asyncio.sleep(0.05)
        assert not start_task.done()
        await release_gate(gate_session)
        await asyncio.wait_for(terminate_task, timeout=3)
        with pytest.raises(BusinessRuleError) as caught:
            await asyncio.wait_for(start_task, timeout=3)
        assert caught.value.code == "ACTIVE_RELATIONSHIP_REQUIRED"

    async with p0_session_factory() as session:
        assignment = await session.get(WorkoutAssignment, assignment_id)
        count = await session.scalar(select(func.count()).select_from(WorkoutExecution))
        assert assignment is not None
        assert assignment.status == WorkoutAssignmentStatus.CANCELLED.value
        assert count == 0


@pytest.mark.parametrize("termination_first", [True, False])
async def test_complete_and_termination_race_converges_to_completed(
    p0_session_factory: async_sessionmaker[AsyncSession],
    termination_first: bool,
) -> None:
    await seed_sources(p0_session_factory)
    assignment_id = await create_assignment(
        p0_session_factory,
        f"complete-termination-{termination_first}",
    )
    async with p0_session_factory() as session:
        await assignment_service.start_execution(session, CLIENT_ID, assignment_id)

    async with (
        p0_session_factory() as gate_session,
        p0_session_factory() as complete_session,
        p0_session_factory() as terminate_session,
    ):
        assert await clients_repository.lock_account(gate_session, CLIENT_ID) is not None

        async def complete() -> WorkoutExecution:
            return await assignment_service.complete_execution(
                complete_session,
                CLIENT_ID,
                assignment_id,
            )

        async def terminate() -> TrainerClientRelationship:
            return await clients_service.terminate_relationship(
                terminate_session,
                CLIENT_ID,
                RELATIONSHIP_ID,
            )

        first_factory = terminate if termination_first else complete
        second_factory = complete if termination_first else terminate
        first_task = asyncio.create_task(first_factory())
        await asyncio.sleep(0.05)
        assert not first_task.done()
        second_task = asyncio.create_task(second_factory())
        await asyncio.sleep(0.05)
        assert not second_task.done()
        await release_gate(gate_session)
        await asyncio.wait_for(first_task, timeout=3)
        await asyncio.wait_for(second_task, timeout=3)

    async with p0_session_factory() as session:
        assignment = await session.get(WorkoutAssignment, assignment_id)
        relationship = await session.get(TrainerClientRelationship, RELATIONSHIP_ID)
        execution = await assignment_service.get_execution(session, CLIENT_ID, assignment_id)
        assert assignment is not None
        assert relationship is not None
        assert assignment.status == WorkoutAssignmentStatus.COMPLETED.value
        assert relationship.status == RelationshipStatus.TERMINATED.value
        assert execution.completed_at is not None
