from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.modules.exercises.models import Exercise


async def list_for_trainer(session: AsyncSession, trainer_id: str) -> Sequence[Exercise]:
    rows = await session.scalars(
        select(Exercise)
        .where(Exercise.trainer_id == trainer_id)
        .order_by(Exercise.title, Exercise.id)
    )
    return rows.all()


async def owned_ids(session: AsyncSession, trainer_id: str, exercise_ids: set[str]) -> set[str]:
    if not exercise_ids:
        return set()
    rows = await session.scalars(
        select(Exercise.id).where(
            Exercise.trainer_id == trainer_id,
            Exercise.id.in_(exercise_ids),
        )
    )
    return set(rows.all())


async def owned_by_ids(
    session: AsyncSession,
    trainer_id: str,
    exercise_ids: set[str],
) -> Sequence[Exercise]:
    if not exercise_ids:
        return []
    rows = await session.scalars(
        select(Exercise).where(
            Exercise.trainer_id == trainer_id,
            Exercise.id.in_(exercise_ids),
        )
    )
    return rows.all()
