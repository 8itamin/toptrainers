from typing import cast

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.auth import current_account
from toptrainers_api.core.db import get_session
from toptrainers_api.modules.workouts import service
from toptrainers_api.modules.workouts.models import Workout
from toptrainers_api.modules.workouts.schemas import (
    WorkoutBlockKind,
    WorkoutBlockResponse,
    WorkoutCreate,
    WorkoutExerciseResponse,
    WorkoutResponse,
)

router = APIRouter(prefix="/workouts", tags=["workouts"])


def to_response(workout: Workout) -> WorkoutResponse:
    return WorkoutResponse(
        id=workout.id,
        trainer_id=workout.trainer_id,
        title=workout.title,
        description=workout.description,
        blocks=[
            WorkoutBlockResponse(
                id=block.id,
                kind=cast(WorkoutBlockKind, block.kind),
                exercises=[
                    WorkoutExerciseResponse(
                        id=item.id,
                        exercise_id=item.exercise_id,
                        weight_kg=float(item.weight_kg) if item.weight_kg is not None else None,
                        sets=item.sets,
                        reps=item.reps,
                    )
                    for item in block.items
                ],
            )
            for block in workout.blocks
        ],
    )


@router.get("", response_model=list[WorkoutResponse])
async def list_workouts(
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> list[WorkoutResponse]:
    return [
        to_response(workout)
        for workout in await service.list_workouts(session, account)
    ]


@router.post("", response_model=WorkoutResponse, status_code=201)
async def create_workout(
    payload: WorkoutCreate,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> WorkoutResponse:
    return to_response(await service.create_workout(session, account, payload))
