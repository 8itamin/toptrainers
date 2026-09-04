from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, cast

from sqlalchemy import and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select
from sqlalchemy.sql.dml import Update

from toptrainers_api.modules.assignments.models import (
    WorkoutAssignment,
    WorkoutAssignmentStatus,
    WorkoutExecution,
)
from toptrainers_api.modules.clients.models import TrainerClientRelationship


@dataclass(slots=True, frozen=True)
class WorkoutHistoryProjection:
    assignment_id: str
    relationship_id: str
    trainer_id: str
    client_id: str
    workout_title: str
    scheduled_date: date
    started_at: datetime
    completed_at: datetime


def assignment_for_update_query(assignment_id: str) -> Select[tuple[WorkoutAssignment]]:
    return select(WorkoutAssignment).where(WorkoutAssignment.id == assignment_id).with_for_update()


def execution_for_update_query(assignment_id: str) -> Select[tuple[WorkoutExecution]]:
    return (
        select(WorkoutExecution)
        .where(WorkoutExecution.assignment_id == assignment_id)
        .with_for_update()
    )


def workout_history_query(
    *,
    client_id: str,
    trainer_id: str | None,
    cursor_completed_at: datetime | None,
    cursor_assignment_id: str | None,
    fetch_limit: int,
) -> Select[tuple[Any, ...]]:
    workout_title = WorkoutAssignment.workout_snapshot["title"].astext
    query = (
        select(
            WorkoutAssignment.id.label("assignment_id"),
            WorkoutAssignment.relationship_id.label("relationship_id"),
            TrainerClientRelationship.trainer_id.label("trainer_id"),
            TrainerClientRelationship.client_id.label("client_id"),
            workout_title.label("workout_title"),
            WorkoutAssignment.scheduled_date.label("scheduled_date"),
            WorkoutExecution.started_at.label("started_at"),
            WorkoutExecution.completed_at.label("completed_at"),
        )
        .select_from(TrainerClientRelationship)
        .join(
            WorkoutAssignment,
            WorkoutAssignment.relationship_id == TrainerClientRelationship.id,
        )
        .join(
            WorkoutExecution,
            WorkoutExecution.assignment_id == WorkoutAssignment.id,
        )
        .where(
            TrainerClientRelationship.client_id == client_id,
            WorkoutAssignment.status == WorkoutAssignmentStatus.COMPLETED.value,
            WorkoutExecution.completed_at.is_not(None),
        )
    )
    if trainer_id is not None:
        query = query.where(TrainerClientRelationship.trainer_id == trainer_id)
    if cursor_completed_at is not None and cursor_assignment_id is not None:
        query = query.where(
            or_(
                WorkoutExecution.completed_at < cursor_completed_at,
                and_(
                    WorkoutExecution.completed_at == cursor_completed_at,
                    WorkoutAssignment.id < cursor_assignment_id,
                ),
            )
        )
    return query.order_by(
        WorkoutExecution.completed_at.desc(),
        WorkoutAssignment.id.desc(),
    ).limit(fetch_limit)


async def get_assignment(
    session: AsyncSession,
    assignment_id: str,
) -> WorkoutAssignment | None:
    assignment: WorkoutAssignment | None = await session.get(WorkoutAssignment, assignment_id)
    return assignment


async def list_for_relationships_and_date(
    session: AsyncSession,
    relationship_ids: list[str],
    scheduled_date: date,
) -> list[WorkoutAssignment]:
    if not relationship_ids:
        return []
    assignments = await session.scalars(
        select(WorkoutAssignment)
        .where(
            WorkoutAssignment.relationship_id.in_(relationship_ids),
            WorkoutAssignment.scheduled_date == scheduled_date,
        )
        .order_by(WorkoutAssignment.created_at, WorkoutAssignment.id)
    )
    return list(assignments)


async def list_workout_history(
    session: AsyncSession,
    *,
    client_id: str,
    trainer_id: str | None,
    cursor_completed_at: datetime | None,
    cursor_assignment_id: str | None,
    fetch_limit: int,
) -> list[WorkoutHistoryProjection]:
    result = await session.execute(
        workout_history_query(
            client_id=client_id,
            trainer_id=trainer_id,
            cursor_completed_at=cursor_completed_at,
            cursor_assignment_id=cursor_assignment_id,
            fetch_limit=fetch_limit,
        )
    )
    projections: list[WorkoutHistoryProjection] = []
    for row in result.mappings():
        completed_at = cast(datetime | None, row["completed_at"])
        workout_title = cast(str | None, row["workout_title"])
        if completed_at is None:
            raise RuntimeError("Workout history query returned an incomplete execution")
        if workout_title is None:
            raise RuntimeError("Workout history assignment snapshot has no title")
        projections.append(
            WorkoutHistoryProjection(
                assignment_id=cast(str, row["assignment_id"]),
                relationship_id=cast(str, row["relationship_id"]),
                trainer_id=cast(str, row["trainer_id"]),
                client_id=cast(str, row["client_id"]),
                workout_title=workout_title,
                scheduled_date=cast(date, row["scheduled_date"]),
                started_at=cast(datetime, row["started_at"]),
                completed_at=completed_at,
            )
        )
    return projections


async def get_by_request_id(
    session: AsyncSession,
    relationship_id: str,
    request_id: str,
) -> WorkoutAssignment | None:
    assignment: WorkoutAssignment | None = await session.scalar(
        select(WorkoutAssignment).where(
            WorkoutAssignment.relationship_id == relationship_id,
            WorkoutAssignment.request_id == request_id,
        )
    )
    return assignment


async def get_relationship_id(session: AsyncSession, assignment_id: str) -> str | None:
    relationship_id: str | None = await session.scalar(
        select(WorkoutAssignment.relationship_id).where(WorkoutAssignment.id == assignment_id)
    )
    return relationship_id


async def lock_assignment(
    session: AsyncSession,
    assignment_id: str,
) -> WorkoutAssignment | None:
    assignment: WorkoutAssignment | None = await session.scalar(
        assignment_for_update_query(assignment_id)
    )
    return assignment


async def get_execution_by_assignment(
    session: AsyncSession,
    assignment_id: str,
) -> WorkoutExecution | None:
    execution: WorkoutExecution | None = await session.scalar(
        select(WorkoutExecution).where(WorkoutExecution.assignment_id == assignment_id)
    )
    return execution


async def lock_execution_by_assignment(
    session: AsyncSession,
    assignment_id: str,
) -> WorkoutExecution | None:
    execution: WorkoutExecution | None = await session.scalar(
        execution_for_update_query(assignment_id)
    )
    return execution


def cancel_planned_for_relationship_query(relationship_id: str) -> Update:
    return (
        update(WorkoutAssignment)
        .where(
            WorkoutAssignment.relationship_id == relationship_id,
            WorkoutAssignment.status == WorkoutAssignmentStatus.PLANNED.value,
        )
        .values(status=WorkoutAssignmentStatus.CANCELLED.value)
    )


async def cancel_planned_for_relationship(
    session: AsyncSession,
    relationship_id: str,
) -> None:
    await session.execute(cancel_planned_for_relationship_query(relationship_id))


def create_payload_matches(
    assignment: WorkoutAssignment,
    *,
    workout_id: str,
    scheduled_date: date,
) -> bool:
    return (
        assignment.source_workout_id == workout_id
        and assignment.scheduled_date == scheduled_date
    )
