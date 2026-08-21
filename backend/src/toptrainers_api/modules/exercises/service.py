from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.modules.exercises import repository
from toptrainers_api.modules.exercises.models import Exercise
from toptrainers_api.modules.exercises.schemas import ExerciseCreate


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
    )
    session.add(exercise)
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
