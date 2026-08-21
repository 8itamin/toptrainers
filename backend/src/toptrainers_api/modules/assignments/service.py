from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.errors import BusinessRuleError
from toptrainers_api.modules.assignments import repository
from toptrainers_api.modules.assignments.models import WorkoutAssignment, WorkoutAssignmentStatus
from toptrainers_api.modules.assignments.schemas import (
    CreateWorkoutAssignmentRequest,
    RescheduleWorkoutAssignmentRequest,
    WorkoutAssignmentResponse,
    WorkoutSnapshotBlockV1,
    WorkoutSnapshotExerciseV1,
    WorkoutSnapshotV1,
)
from toptrainers_api.modules.clients import service as clients_service
from toptrainers_api.modules.clients.models import TrainerClientRelationship
from toptrainers_api.modules.exercises import service as exercises_service
from toptrainers_api.modules.exercises.models import Exercise
from toptrainers_api.modules.workouts import service as workouts_service
from toptrainers_api.modules.workouts.models import Workout

_REQUEST_ID_CONSTRAINT = "uq_workout_assignments_relationship_request_id"


@dataclass(slots=True, frozen=True)
class AssignmentResult:
    assignment: WorkoutAssignment
    trainer_id: str
    client_id: str


def _conflict(code: str, message: str) -> BusinessRuleError:
    return BusinessRuleError(status_code=409, code=code, message=message)


def _not_found(code: str, message: str) -> BusinessRuleError:
    return BusinessRuleError(status_code=404, code=code, message=message)


def _forbidden(code: str, message: str) -> BusinessRuleError:
    return BusinessRuleError(status_code=403, code=code, message=message)


def _integrity_constraint_name(error: IntegrityError) -> str | None:
    current: object | None = error.orig
    visited: set[int] = set()
    while current is not None and id(current) not in visited:
        visited.add(id(current))
        constraint_name = getattr(current, "constraint_name", None)
        if isinstance(constraint_name, str):
            return constraint_name
        cause = getattr(current, "__cause__", None)
        if isinstance(cause, BaseException):
            current = cause
            continue
        context = getattr(current, "__context__", None)
        current = context if isinstance(context, BaseException) else None
    return None


def build_workout_snapshot_v1(
    workout: Workout,
    exercises_by_id: dict[str, Exercise],
) -> WorkoutSnapshotV1:
    blocks: list[WorkoutSnapshotBlockV1] = []
    for block in workout.blocks:
        snapshot_exercises: list[WorkoutSnapshotExerciseV1] = []
        for item in block.items:
            exercise = exercises_by_id.get(item.exercise_id)
            if exercise is None:
                raise RuntimeError("Workout references an exercise unavailable for snapshot")
            snapshot_exercises.append(
                WorkoutSnapshotExerciseV1(
                    source_exercise_id=exercise.id,
                    position=item.position,
                    title=exercise.title,
                    direction=exercise.direction,
                    muscle_group=exercise.muscle_group,
                    instruction=exercise.instruction,
                    reference_url=exercise.reference_url,
                    video_platform=exercise.video_platform,
                    video_url=exercise.video_url,
                    video_file_url=exercise.video_file_url,
                    thumbnail_url=exercise.thumbnail_url,
                    weight_kg=float(item.weight_kg) if item.weight_kg is not None else None,
                    sets=item.sets,
                    reps=item.reps,
                )
            )
        blocks.append(
            WorkoutSnapshotBlockV1(
                kind=block.kind,
                position=block.position,
                exercises=snapshot_exercises,
            )
        )
    return WorkoutSnapshotV1(
        title=workout.title,
        description=workout.description,
        blocks=blocks,
    )


def to_response(result: AssignmentResult) -> WorkoutAssignmentResponse:
    assignment = result.assignment
    return WorkoutAssignmentResponse(
        id=assignment.id,
        relationship_id=assignment.relationship_id,
        trainer_id=result.trainer_id,
        client_id=result.client_id,
        source_workout_id=assignment.source_workout_id,
        request_id=assignment.request_id,
        scheduled_date=assignment.scheduled_date,
        status=assignment.status,
        snapshot_schema_version=assignment.snapshot_schema_version,
        workout_snapshot=WorkoutSnapshotV1.model_validate(assignment.workout_snapshot),
        created_at=assignment.created_at,
        updated_at=assignment.updated_at,
    )


def _result(
    assignment: WorkoutAssignment,
    relationship: TrainerClientRelationship,
) -> AssignmentResult:
    return AssignmentResult(
        assignment=assignment,
        trainer_id=relationship.trainer_id,
        client_id=relationship.client_id,
    )


async def create_assignment(
    session: AsyncSession,
    trainer_id: str,
    payload: CreateWorkoutAssignmentRequest,
) -> AssignmentResult:
    relationship = await clients_service.lock_active_relationship_for_trainer_client(
        session,
        trainer_id,
        payload.client_id,
    )
    if relationship is None:
        raise _conflict(
            "ACTIVE_RELATIONSHIP_REQUIRED",
            "An active trainer-client relationship is required",
        )

    existing = await repository.get_by_request_id(
        session,
        relationship.id,
        payload.request_id,
    )
    if existing is not None:
        if not repository.create_payload_matches(
            existing,
            workout_id=payload.workout_id,
            scheduled_date=payload.scheduled_date,
        ):
            raise _conflict(
                "ASSIGNMENT_REQUEST_ID_CONFLICT",
                "request_id was already used for a different assignment payload",
            )
        return AssignmentResult(existing, trainer_id, payload.client_id)

    workout = await workouts_service.get_owned_workout(session, trainer_id, payload.workout_id)
    if workout is None:
        raise _not_found("WORKOUT_NOT_FOUND", "Workout template was not found")

    exercise_ids = {item.exercise_id for block in workout.blocks for item in block.items}
    exercises = await exercises_service.get_owned_exercises(session, trainer_id, exercise_ids)
    exercises_by_id = {exercise.id: exercise for exercise in exercises}
    if set(exercises_by_id) != exercise_ids:
        raise RuntimeError("Workout references exercises unavailable for snapshot")

    snapshot = build_workout_snapshot_v1(workout, exercises_by_id)
    assignment = WorkoutAssignment(
        id=str(uuid4()),
        relationship_id=relationship.id,
        source_workout_id=payload.workout_id,
        request_id=payload.request_id,
        workout_snapshot=snapshot.model_dump(mode="json"),
        snapshot_schema_version=1,
        scheduled_date=payload.scheduled_date,
        status=WorkoutAssignmentStatus.PLANNED.value,
    )
    session.add(assignment)
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        if _integrity_constraint_name(error) != _REQUEST_ID_CONSTRAINT:
            raise
        existing = await repository.get_by_request_id(
            session,
            relationship.id,
            payload.request_id,
        )
        if existing is not None and repository.create_payload_matches(
            existing,
            workout_id=payload.workout_id,
            scheduled_date=payload.scheduled_date,
        ):
            return AssignmentResult(existing, trainer_id, payload.client_id)
        raise _conflict(
            "ASSIGNMENT_REQUEST_ID_CONFLICT",
            "request_id was already used for a different assignment payload",
        ) from error
    await session.refresh(assignment)
    return AssignmentResult(assignment, trainer_id, payload.client_id)


async def _lock_assignment_context(
    session: AsyncSession,
    trainer_id: str,
    assignment_id: str,
) -> tuple[WorkoutAssignment, TrainerClientRelationship]:
    relationship_id = await repository.get_relationship_id(session, assignment_id)
    if relationship_id is None:
        raise _not_found("ASSIGNMENT_NOT_FOUND", "Workout assignment was not found")

    relationship = await clients_service.lock_relationship_with_client(session, relationship_id)
    if relationship is None:
        raise RuntimeError("Assignment relationship was not found")
    if relationship.trainer_id != trainer_id:
        raise _forbidden(
            "ASSIGNMENT_TRAINER_REQUIRED",
            "Only the relationship trainer can mutate this assignment",
        )

    assignment = await repository.lock_assignment(session, assignment_id)
    if assignment is None:
        raise _not_found("ASSIGNMENT_NOT_FOUND", "Workout assignment was not found")
    if assignment.relationship_id != relationship.id:
        raise RuntimeError("Assignment relationship changed unexpectedly")
    return assignment, relationship


async def reschedule_assignment(
    session: AsyncSession,
    trainer_id: str,
    assignment_id: str,
    payload: RescheduleWorkoutAssignmentRequest,
) -> AssignmentResult:
    assignment, relationship = await _lock_assignment_context(
        session,
        trainer_id,
        assignment_id,
    )
    if assignment.status != WorkoutAssignmentStatus.PLANNED.value:
        raise _conflict("ASSIGNMENT_NOT_PLANNED", "Only planned assignments can be rescheduled")
    assignment.scheduled_date = payload.scheduled_date
    await session.commit()
    await session.refresh(assignment)
    return _result(assignment, relationship)


async def cancel_assignment(
    session: AsyncSession,
    trainer_id: str,
    assignment_id: str,
) -> AssignmentResult:
    assignment, relationship = await _lock_assignment_context(
        session,
        trainer_id,
        assignment_id,
    )
    if assignment.status != WorkoutAssignmentStatus.PLANNED.value:
        raise _conflict("ASSIGNMENT_NOT_PLANNED", "Only planned assignments can be cancelled")
    assignment.status = WorkoutAssignmentStatus.CANCELLED.value
    await session.commit()
    await session.refresh(assignment)
    return _result(assignment, relationship)


async def cancel_planned_for_relationship(
    session: AsyncSession,
    relationship_id: str,
) -> None:
    """Cancel PLANNED rows inside a caller-owned Relationship transaction; no commit."""
    await repository.cancel_planned_for_relationship(session, relationship_id)
