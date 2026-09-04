from __future__ import annotations

from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.errors import BusinessRuleError
from toptrainers_api.modules.assignments import repository as assignment_repository
from toptrainers_api.modules.assignments import results_repository
from toptrainers_api.modules.assignments.models import (
    WorkoutAssignment,
    WorkoutAssignmentStatus,
    WorkoutExecution,
    WorkoutExecutionSetResult,
)
from toptrainers_api.modules.assignments.schemas import (
    WorkoutExecutionSetResultResponse,
    WorkoutExecutionSetResultUpsertRequest,
    WorkoutSnapshotV1,
)
from toptrainers_api.modules.clients import service as clients_service


def _not_found(code: str, message: str) -> BusinessRuleError:
    return BusinessRuleError(status_code=404, code=code, message=message)


def _conflict(code: str, message: str) -> BusinessRuleError:
    return BusinessRuleError(status_code=409, code=code, message=message)


def _forbidden(code: str, message: str) -> BusinessRuleError:
    return BusinessRuleError(status_code=403, code=code, message=message)


def _validate_coordinate(
    assignment: WorkoutAssignment,
    block_position: int,
    exercise_position: int,
    set_index: int,
) -> None:
    snapshot = WorkoutSnapshotV1.model_validate(assignment.workout_snapshot)
    block = next(
        (candidate for candidate in snapshot.blocks if candidate.position == block_position),
        None,
    )
    if block is None:
        raise _not_found(
            "RESULT_COORDINATE_NOT_FOUND",
            "Result coordinate does not exist in the frozen assignment snapshot",
        )
    exercise = next(
        (
            candidate
            for candidate in block.exercises
            if candidate.position == exercise_position
        ),
        None,
    )
    if exercise is None or set_index >= exercise.sets:
        raise _not_found(
            "RESULT_COORDINATE_NOT_FOUND",
            "Result coordinate does not exist in the frozen assignment snapshot",
        )


async def _lock_client_mutation_context(
    session: AsyncSession,
    client_id: str,
    assignment_id: str,
) -> tuple[WorkoutAssignment, WorkoutExecution]:
    relationship_id = await assignment_repository.get_relationship_id(session, assignment_id)
    if relationship_id is None:
        raise _not_found("ASSIGNMENT_NOT_FOUND", "Workout assignment was not found")

    relationship = await clients_service.lock_relationship_with_client(session, relationship_id)
    if relationship is None or relationship.client_id != client_id:
        raise _not_found("ASSIGNMENT_NOT_FOUND", "Workout assignment was not found")

    assignment = await assignment_repository.lock_assignment(session, assignment_id)
    if assignment is None or assignment.relationship_id != relationship.id:
        raise _not_found("ASSIGNMENT_NOT_FOUND", "Workout assignment was not found")
    if assignment.status not in {
        WorkoutAssignmentStatus.IN_PROGRESS.value,
        WorkoutAssignmentStatus.COMPLETED.value,
    }:
        raise _conflict(
            "ASSIGNMENT_RESULTS_NOT_MUTABLE",
            "Results can be changed only for in-progress or completed assignments",
        )

    execution = await assignment_repository.lock_execution_by_assignment(session, assignment.id)
    if execution is None:
        raise _not_found("EXECUTION_NOT_FOUND", "Workout execution was not found")
    return assignment, execution


async def put_result(
    session: AsyncSession,
    client_id: str,
    assignment_id: str,
    block_position: int,
    exercise_position: int,
    set_index: int,
    payload: WorkoutExecutionSetResultUpsertRequest,
) -> WorkoutExecutionSetResult:
    assignment, execution = await _lock_client_mutation_context(
        session,
        client_id,
        assignment_id,
    )
    _validate_coordinate(assignment, block_position, exercise_position, set_index)

    actual_weight_kg = (
        Decimal(str(payload.actual_weight_kg))
        if payload.actual_weight_kg is not None
        else None
    )
    await results_repository.upsert_result(
        session,
        execution_id=execution.id,
        block_position=block_position,
        exercise_position=exercise_position,
        set_index=set_index,
        actual_reps=payload.actual_reps,
        actual_weight_kg=actual_weight_kg,
    )
    await session.commit()
    result = await results_repository.get_result(
        session,
        execution_id=execution.id,
        block_position=block_position,
        exercise_position=exercise_position,
        set_index=set_index,
    )
    if result is None:
        raise RuntimeError("Workout result upsert committed without a result row")
    return result


async def delete_result(
    session: AsyncSession,
    client_id: str,
    assignment_id: str,
    block_position: int,
    exercise_position: int,
    set_index: int,
) -> None:
    assignment, execution = await _lock_client_mutation_context(
        session,
        client_id,
        assignment_id,
    )
    _validate_coordinate(assignment, block_position, exercise_position, set_index)
    await results_repository.delete_result(
        session,
        execution_id=execution.id,
        block_position=block_position,
        exercise_position=exercise_position,
        set_index=set_index,
    )
    await session.commit()


async def list_results(
    session: AsyncSession,
    actor_id: str,
    actor_role: str,
    assignment_id: str,
) -> list[WorkoutExecutionSetResult]:
    assignment = await assignment_repository.get_assignment(session, assignment_id)
    if assignment is None:
        raise _not_found("ASSIGNMENT_NOT_FOUND", "Workout assignment was not found")

    relationship = await clients_service.get_relationship(session, assignment.relationship_id)
    if relationship is None:
        raise RuntimeError("Assignment relationship was not found")

    if actor_role == "client":
        if relationship.client_id != actor_id:
            raise _not_found("ASSIGNMENT_NOT_FOUND", "Workout assignment was not found")
    elif actor_role == "trainer":
        if relationship.trainer_id != actor_id:
            raise _not_found("ASSIGNMENT_NOT_FOUND", "Workout assignment was not found")
    else:
        raise _forbidden(
            "ROLE_NOT_ALLOWED",
            "Trainer or client role is required for workout result reads",
        )

    execution = await assignment_repository.get_execution_by_assignment(session, assignment.id)
    if execution is None:
        raise _not_found("EXECUTION_NOT_FOUND", "Workout execution was not found")

    if actor_role == "trainer":
        if (
            assignment.status != WorkoutAssignmentStatus.COMPLETED.value
            or execution.completed_at is None
        ):
            raise _conflict(
                "EXECUTION_NOT_COMPLETED",
                "Trainer can read workout results only after execution completion",
            )
    elif assignment.status not in {
        WorkoutAssignmentStatus.IN_PROGRESS.value,
        WorkoutAssignmentStatus.COMPLETED.value,
    }:
        raise _conflict(
            "ASSIGNMENT_RESULTS_NOT_READABLE",
            "Results are readable only for in-progress or completed assignments",
        )

    return await results_repository.list_results(session, execution.id)


def to_response(result: WorkoutExecutionSetResult) -> WorkoutExecutionSetResultResponse:
    return WorkoutExecutionSetResultResponse(
        execution_id=result.execution_id,
        block_position=result.block_position,
        exercise_position=result.exercise_position,
        set_index=result.set_index,
        actual_reps=result.actual_reps,
        actual_weight_kg=(
            float(result.actual_weight_kg)
            if result.actual_weight_kg is not None
            else None
        ),
    )
