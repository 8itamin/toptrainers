from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.modules.exercises import repository
from toptrainers_api.modules.exercises.models import Exercise
from toptrainers_api.modules.exercises.schemas import ExerciseCreate, ExercisePatch


def require_trainer(account: dict[str, object]) -> str:
    if account.get("role") != "trainer":
        raise HTTPException(status_code=403, detail="Trainer role required")
    return str(account["sub"])


async def list_exercises(session: AsyncSession, account: dict[str, object]) -> list[Exercise]:
    return list(await repository.list_for_trainer(session, require_trainer(account)))


async def create_exercise(
    session: AsyncSession,
    account: dict[str, object],
    payload: ExerciseCreate,
) -> Exercise:
    exercise = Exercise(
        id=str(uuid4()),
        trainer_id=require_trainer(account),
        **payload.model_dump(),
        muscle_groups=[payload.muscle_group],
    )
    session.add(exercise)
    await session.commit()
    await session.refresh(exercise)
    return exercise


async def update_exercise(
    session: AsyncSession,
    account: dict[str, object],
    exercise_id: str,
    payload: ExercisePatch,
) -> Exercise:
    trainer_id = require_trainer(account)
    exercise = await repository.get_for_trainer(session, trainer_id, exercise_id)
    if exercise is None:
        raise HTTPException(status_code=404, detail="Exercise not found")

    values = payload.model_dump(exclude_unset=True)
    for field_name in ("title", "instruction", "video_media_id"):
        if field_name in values:
            setattr(exercise, field_name, values[field_name])
    if "muscle_groups" in values:
        muscle_groups = values["muscle_groups"]
        assert isinstance(muscle_groups, list)
        exercise.muscle_groups = muscle_groups
        exercise.muscle_group = muscle_groups[0]

    await session.commit()
    await session.refresh(exercise)
    return exercise


async def get_owned_exercise_ids(
    session: AsyncSession,
    trainer_id: str,
    exercise_ids: set[str],
) -> set[str]:
    """Public cross-module contract: return only exercises owned by this trainer."""
    return await repository.owned_ids(session, trainer_id, exercise_ids)


async def get_owned_exercises(
    session: AsyncSession,
    trainer_id: str,
    exercise_ids: set[str],
) -> list[Exercise]:
    """Public cross-module contract returning trainer-owned Exercise rows."""
    return list(await repository.owned_by_ids(session, trainer_id, exercise_ids))
