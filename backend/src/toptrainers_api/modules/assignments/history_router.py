from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.auth import current_account
from toptrainers_api.core.db import get_session
from toptrainers_api.modules.assignments import history_service
from toptrainers_api.modules.assignments.schemas import WorkoutHistoryPage

router = APIRouter(tags=["assignments"])

CurrentAccountDep = Annotated[dict[str, object], Depends(current_account)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]
HistoryLimit = Annotated[int, Query(ge=1, le=50)]


def _require_client(account: dict[str, object]) -> str:
    if account.get("role") != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ROLE_NOT_ALLOWED", "message": "Client role is required"},
        )
    return str(account["sub"])


def _require_trainer(account: dict[str, object]) -> str:
    if account.get("role") != "trainer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ROLE_NOT_ALLOWED", "message": "Trainer role is required"},
        )
    return str(account["sub"])


def _invalid_cursor() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={"code": "INVALID_HISTORY_CURSOR", "message": "History cursor is invalid"},
    )


@router.get(
    "/workout-history",
    operation_id="listClientWorkoutHistory",
    response_model=WorkoutHistoryPage,
)
async def list_client_workout_history(
    account: CurrentAccountDep,
    session: SessionDep,
    limit: HistoryLimit = 20,
    cursor: str | None = None,
) -> WorkoutHistoryPage:
    client_id = _require_client(account)
    try:
        return await history_service.list_client_workout_history(
            session,
            client_id,
            cursor=cursor,
            limit=limit,
        )
    except history_service.InvalidHistoryCursor as exc:
        raise _invalid_cursor() from exc


@router.get(
    "/clients/{client_id}/workout-history",
    operation_id="listTrainerClientWorkoutHistory",
    response_model=WorkoutHistoryPage,
)
async def list_trainer_client_workout_history(
    client_id: str,
    account: CurrentAccountDep,
    session: SessionDep,
    limit: HistoryLimit = 20,
    cursor: str | None = None,
) -> WorkoutHistoryPage:
    trainer_id = _require_trainer(account)
    try:
        return await history_service.list_trainer_client_workout_history(
            session,
            trainer_id,
            client_id,
            cursor=cursor,
            limit=limit,
        )
    except history_service.InvalidHistoryCursor as exc:
        raise _invalid_cursor() from exc
