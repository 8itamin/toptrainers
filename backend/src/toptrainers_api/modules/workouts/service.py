from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.modules.exercises.service import get_owned_exercise_ids, require_trainer
from toptrainers_api.modules.workouts import repository
from toptrainers_api.modules.workouts.models import Workout, WorkoutBlock, WorkoutExercise
from toptrainers_api.modules.workouts.schemas import WorkoutCreate


async def list_workouts(session: AsyncSession, account: dict[str, object]) -> list[Workout]:
    return list(await repository.list_for_trainer(session, require_trainer(account)))


async def create_workout(
    session: AsyncSession,
    account: dict[str, object],
    payload: WorkoutCreate,
) -> Workout:
    trainer_id = require_trainer(account)
    exercise_ids = {
        exercise.exercise_id
        for block in payload.blocks
        for exercise in block.exercises
    }
    owned_ids = await get_owned_exercise_ids(session, trainer_id, exercise_ids)
    if owned_ids != exercise_ids:
        raise HTTPException(
            status_code=422,
            detail="Every workout exercise must belong to the trainer",
        )

    workout = Workout(
        id=str(uuid4()),
        trainer_id=trainer_id,
        title=payload.title,
        description=payload.description,
    )
    for block_position, block_payload in enumerate(payload.blocks):
        block = WorkoutBlock(
            id=str(uuid4()),
            kind=block_payload.kind,
            position=block_position,
        )
        for exercise_position, exercise_payload in enumerate(block_payload.exercises):
            block.items.append(
                WorkoutExercise(
                    id=str(uuid4()),
                    exercise_id=exercise_payload.exercise_id,
                    position=exercise_position,
                    weight_kg=exercise_payload.weight_kg,
                    sets=exercise_payload.sets,
                    reps=exercise_payload.reps,
                )
            )
        workout.blocks.append(block)
    session.add(workout)
    await session.commit()
    saved_workout = await repository.get_for_trainer(session, trainer_id, workout.id)
    if saved_workout is None:
        raise RuntimeError("Created workout was not found")
    return saved_workout
