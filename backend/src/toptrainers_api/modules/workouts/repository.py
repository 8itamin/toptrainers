from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from toptrainers_api.modules.workouts.models import Workout, WorkoutBlock


async def list_for_trainer(session: AsyncSession, trainer_id: str) -> Sequence[Workout]:
    rows = await session.scalars(
        select(Workout)
        .where(Workout.trainer_id == trainer_id)
        .options(selectinload(Workout.blocks).selectinload(WorkoutBlock.items))
        .order_by(Workout.title, Workout.id)
    )
    return rows.unique().all()


async def get_for_trainer(
    session: AsyncSession,
    trainer_id: str,
    workout_id: str,
) -> Workout | None:
    workout: Workout | None = await session.scalar(
        select(Workout)
        .where(Workout.trainer_id == trainer_id, Workout.id == workout_id)
        .options(selectinload(Workout.blocks).selectinload(WorkoutBlock.items))
    )
    return workout
