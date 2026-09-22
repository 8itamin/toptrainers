from collections.abc import Sequence
from datetime import date
from typing import cast

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.modules.tasks.models import TaskAssignment, TaskResultVersion, TaskTemplate


async def list_for_trainer(session: AsyncSession, trainer_id: str) -> Sequence[TaskTemplate]:
    templates = await session.scalars(
        select(TaskTemplate)
        .where(TaskTemplate.trainer_id == trainer_id)
        .order_by(TaskTemplate.title, TaskTemplate.id)
    )
    return templates.all()


async def get_owned_template(
    session: AsyncSession,
    trainer_id: str,
    task_template_id: str,
) -> TaskTemplate | None:
    return cast(
        TaskTemplate | None,
        await session.scalar(
            select(TaskTemplate).where(
                TaskTemplate.id == task_template_id,
                TaskTemplate.trainer_id == trainer_id,
            )
        ),
    )


async def cancel_pending_for_program_assignment(
    session: AsyncSession,
    program_assignment_id: str,
) -> None:
    await session.execute(
        update(TaskAssignment)
        .where(
            TaskAssignment.program_assignment_id == program_assignment_id,
            TaskAssignment.status == "PENDING",
        )
        .values(status="CANCELLED")
    )


async def get_assignment_for_update(
    session: AsyncSession,
    assignment_id: str,
) -> TaskAssignment | None:
    return cast(
        TaskAssignment | None,
        await session.scalar(
            select(TaskAssignment).where(TaskAssignment.id == assignment_id).with_for_update()
        ),
    )


async def get_assignment(session: AsyncSession, assignment_id: str) -> TaskAssignment | None:
    return await session.get(TaskAssignment, assignment_id)


async def list_for_relationships_and_date(
    session: AsyncSession,
    relationship_ids: list[str],
    scheduled_date: date,
) -> list[TaskAssignment]:
    if not relationship_ids:
        return []
    assignments = await session.scalars(
        select(TaskAssignment)
        .where(
            TaskAssignment.relationship_id.in_(relationship_ids),
            TaskAssignment.scheduled_date == scheduled_date,
        )
        .order_by(TaskAssignment.id)
    )
    return list(assignments)


async def get_result_by_request_id(
    session: AsyncSession,
    assignment_id: str,
    request_id: str,
) -> TaskResultVersion | None:
    return cast(
        TaskResultVersion | None,
        await session.scalar(
            select(TaskResultVersion).where(
                TaskResultVersion.assignment_id == assignment_id,
                TaskResultVersion.request_id == request_id,
            )
        ),
    )


async def next_result_version(session: AsyncSession, assignment_id: str) -> int:
    current = await session.scalar(
        select(func.max(TaskResultVersion.version)).where(
            TaskResultVersion.assignment_id == assignment_id
        )
    )
    return int(current or 0) + 1


async def list_result_versions(
    session: AsyncSession,
    assignment_id: str,
) -> list[TaskResultVersion]:
    versions = await session.scalars(
        select(TaskResultVersion)
        .where(TaskResultVersion.assignment_id == assignment_id)
        .order_by(TaskResultVersion.version.desc())
    )
    return list(versions)
