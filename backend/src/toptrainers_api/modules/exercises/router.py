from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.auth import current_account
from toptrainers_api.core.db import get_session
from toptrainers_api.modules.exercises import service
from toptrainers_api.modules.exercises.schemas import ExerciseCreate, ExerciseResponse

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("", response_model=list[ExerciseResponse])
async def list_exercises(
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> list[ExerciseResponse]:
    rows = await service.list_exercises(session, account)
    return [ExerciseResponse.model_validate(row, from_attributes=True) for row in rows]


@router.post("", response_model=ExerciseResponse, status_code=201)
async def create_exercise(
    payload: ExerciseCreate,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> ExerciseResponse:
    exercise = await service.create_exercise(session, account, payload)
    return ExerciseResponse.model_validate(exercise, from_attributes=True)
