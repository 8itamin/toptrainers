from __future__ import annotations

from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.auth import current_account
from toptrainers_api.core.db import get_session
from toptrainers_api.core.errors import BusinessErrorResponse, BusinessRuleError, as_http_exception
from toptrainers_api.modules.assignments import service
from toptrainers_api.modules.assignments.schemas import (
    CreateWorkoutAssignmentRequest,
    RescheduleWorkoutAssignmentRequest,
    WorkoutAssignmentResponse,
)

router = APIRouter(prefix="/assignments", tags=["assignments"])

CurrentAccountDep = Annotated[dict[str, object], Depends(current_account)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]

_BUSINESS_RESPONSES: dict[int | str, dict[str, Any]] = {
    403: {"model": BusinessErrorResponse},
    404: {"model": BusinessErrorResponse},
    409: {"model": BusinessErrorResponse},
}
_READ_RESPONSES: dict[int | str, dict[str, Any]] = {
    403: {"model": BusinessErrorResponse},
    404: {"model": BusinessErrorResponse},
}
_CLIENT_LIST_RESPONSES: dict[int | str, dict[str, Any]] = {
    403: {"model": BusinessErrorResponse},
}


def _require_trainer(account: dict[str, object]) -> str:
    if account.get("role") != "trainer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ROLE_NOT_ALLOWED",
                "message": "Trainer role is required for workout assignment mutations",
            },
        )
    return str(account["sub"])


def _require_client(account: dict[str, object]) -> str:
    if account.get("role") != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ROLE_NOT_ALLOWED",
                "message": "Client role is required for workout assignment discovery",
            },
        )
    return str(account["sub"])


def _require_assignment_reader(account: dict[str, object]) -> str:
    if account.get("role") not in {"trainer", "client"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ROLE_NOT_ALLOWED",
                "message": "Trainer or client role is required for workout assignment reads",
            },
        )
    return str(account["sub"])


@router.get(
    "",
    operation_id="listClientWorkoutAssignmentsByDate",
    response_model=list[WorkoutAssignmentResponse],
    responses=_CLIENT_LIST_RESPONSES,
)
async def list_client_workout_assignments_by_date(
    scheduled_date: date,
    account: CurrentAccountDep,
    session: SessionDep,
) -> list[WorkoutAssignmentResponse]:
    client_id = _require_client(account)
    results = await service.list_client_assignments_by_date(
        session,
        client_id,
        scheduled_date,
    )
    return [service.to_response(result) for result in results]


@router.get(
    "/{assignment_id}",
    operation_id="getWorkoutAssignment",
    response_model=WorkoutAssignmentResponse,
    responses=_READ_RESPONSES,
)
async def get_workout_assignment(
    assignment_id: str,
    account: CurrentAccountDep,
    session: SessionDep,
) -> WorkoutAssignmentResponse:
    actor_id = _require_assignment_reader(account)
    try:
        result = await service.get_assignment(session, actor_id, assignment_id)
    except BusinessRuleError as error:
        raise as_http_exception(error) from error
    return service.to_response(result)


@router.post(
    "",
    operation_id="createWorkoutAssignment",
    response_model=WorkoutAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    responses=_BUSINESS_RESPONSES,
)
async def create_workout_assignment(
    payload: CreateWorkoutAssignmentRequest,
    account: CurrentAccountDep,
    session: SessionDep,
) -> WorkoutAssignmentResponse:
    trainer_id = _require_trainer(account)
    try:
        result = await service.create_assignment(session, trainer_id, payload)
    except BusinessRuleError as error:
        raise as_http_exception(error) from error
    return service.to_response(result)


@router.post(
    "/{assignment_id}/reschedule",
    operation_id="rescheduleWorkoutAssignment",
    response_model=WorkoutAssignmentResponse,
    responses=_BUSINESS_RESPONSES,
)
async def reschedule_workout_assignment(
    assignment_id: str,
    payload: RescheduleWorkoutAssignmentRequest,
    account: CurrentAccountDep,
    session: SessionDep,
) -> WorkoutAssignmentResponse:
    trainer_id = _require_trainer(account)
    try:
        result = await service.reschedule_assignment(
            session,
            trainer_id,
            assignment_id,
            payload,
        )
    except BusinessRuleError as error:
        raise as_http_exception(error) from error
    return service.to_response(result)


@router.post(
    "/{assignment_id}/cancel",
    operation_id="cancelWorkoutAssignment",
    response_model=WorkoutAssignmentResponse,
    responses=_BUSINESS_RESPONSES,
)
async def cancel_workout_assignment(
    assignment_id: str,
    account: CurrentAccountDep,
    session: SessionDep,
) -> WorkoutAssignmentResponse:
    trainer_id = _require_trainer(account)
    try:
        result = await service.cancel_assignment(session, trainer_id, assignment_id)
    except BusinessRuleError as error:
        raise as_http_exception(error) from error
    return service.to_response(result)
