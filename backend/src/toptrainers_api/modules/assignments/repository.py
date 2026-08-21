from __future__ import annotations

from datetime import date

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select
from sqlalchemy.sql.dml import Update

from toptrainers_api.modules.assignments.models import WorkoutAssignment, WorkoutAssignmentStatus


def assignment_for_update_query(assignment_id: str) -> Select[tuple[WorkoutAssignment]]:
    return select(WorkoutAssignment).where(WorkoutAssignment.id == assignment_id).with_for_update()


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
