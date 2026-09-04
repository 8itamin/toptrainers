from __future__ import annotations

from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.modules.assignments.models import WorkoutExecutionSetResult


async def upsert_result(
    session: AsyncSession,
    *,
    execution_id: str,
    block_position: int,
    exercise_position: int,
    set_index: int,
    actual_reps: int | None,
    actual_weight_kg: Decimal | None,
) -> None:
    statement = insert(WorkoutExecutionSetResult).values(
        execution_id=execution_id,
        block_position=block_position,
        exercise_position=exercise_position,
        set_index=set_index,
        actual_reps=actual_reps,
        actual_weight_kg=actual_weight_kg,
    )
    statement = statement.on_conflict_do_update(
        index_elements=[
            WorkoutExecutionSetResult.execution_id,
            WorkoutExecutionSetResult.block_position,
            WorkoutExecutionSetResult.exercise_position,
            WorkoutExecutionSetResult.set_index,
        ],
        set_={
            "actual_reps": actual_reps,
            "actual_weight_kg": actual_weight_kg,
        },
    )
    await session.execute(statement)


async def get_result(
    session: AsyncSession,
    *,
    execution_id: str,
    block_position: int,
    exercise_position: int,
    set_index: int,
) -> WorkoutExecutionSetResult | None:
    result: WorkoutExecutionSetResult | None = await session.get(
        WorkoutExecutionSetResult,
        {
            "execution_id": execution_id,
            "block_position": block_position,
            "exercise_position": exercise_position,
            "set_index": set_index,
        },
    )
    return result


async def list_results(
    session: AsyncSession,
    execution_id: str,
) -> list[WorkoutExecutionSetResult]:
    rows = await session.scalars(
        select(WorkoutExecutionSetResult)
        .where(WorkoutExecutionSetResult.execution_id == execution_id)
        .order_by(
            WorkoutExecutionSetResult.block_position,
            WorkoutExecutionSetResult.exercise_position,
            WorkoutExecutionSetResult.set_index,
        )
    )
    return list(rows)


async def delete_result(
    session: AsyncSession,
    *,
    execution_id: str,
    block_position: int,
    exercise_position: int,
    set_index: int,
) -> None:
    await session.execute(
        delete(WorkoutExecutionSetResult).where(
            WorkoutExecutionSetResult.execution_id == execution_id,
            WorkoutExecutionSetResult.block_position == block_position,
            WorkoutExecutionSetResult.exercise_position == exercise_position,
            WorkoutExecutionSetResult.set_index == set_index,
        )
    )
