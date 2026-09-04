from __future__ import annotations

from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.auth import current_account
from toptrainers_api.core.db import get_session
from toptrainers_api.core.errors import BusinessErrorResponse, BusinessRuleError, as_http_exception
from toptrainers_api.modules.assignments import results_service, service
from toptrainers_api.modules.assignments.schemas import (
    CreateWorkoutAssignmentRequest,
    RescheduleWorkoutAssignmentRequest,
    WorkoutAssignmentResponse,
    WorkoutExecutionResponse,
    WorkoutExecutionSetResultResponse,
    WorkoutExecutionSetResultUpsertRequest,
)

router = APIRouter(prefix="/assignments", tags=["assignments"])

CurrentAccountDep = Annotated[dict[str, object], Depends(current_account)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]
ResultCoordinate = Annotated[int, Path(ge=0)]

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


def _require_execution_client(account: dict[str, object]) -> str:
    if account.get("role") != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ROLE_NOT_ALLOWED",
                "message": "Client role is required for workout execution mutations",
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


@router.post(
    "/{assignment_id}/execution/start",
    operation_id="startWorkoutExecution",
    response_model=WorkoutExecutionResponse,
    responses=_BUSINESS_RESPONSES,
)
async def start_workout_execution(
    assignment_id: str,
    account: CurrentAccountDep,
    session: SessionDep,
) -> WorkoutExecutionResponse:
    client_id = _require_execution_client(account)
    try:
        execution = await service.start_execution(session, client_id, assignment_id)
    except BusinessRuleError as error:
        raise as_http_exception(error) from error
    return service.execution_to_response(execution)


@router.get(
    "/{assignment_id}/execution",
    operation_id="getWorkoutExecution",
    response_model=WorkoutExecutionResponse,
    responses=_READ_RESPONSES,
)
async def get_workout_execution(
    assignment_id: str,
    account: CurrentAccountDep,
    session: SessionDep,
) -> WorkoutExecutionResponse:
    actor_id = _require_assignment_reader(account)
    try:
        execution = await service.get_execution(session, actor_id, assignment_id)
    except BusinessRuleError as error:
        raise as_http_exception(error) from error
    return service.execution_to_response(execution)


@router.post(
    "/{assignment_id}/execution/complete",
    operation_id="completeWorkoutExecution",
    response_model=WorkoutExecutionResponse,
    responses=_BUSINESS_RESPONSES,
)
async def complete_workout_execution(
    assignment_id: str,
    account: CurrentAccountDep,
    session: SessionDep,
) -> WorkoutExecutionResponse:
    client_id = _require_execution_client(account)
    try:
        execution = await service.complete_execution(session, client_id, assignment_id)
    except BusinessRuleError as error:
        raise as_http_exception(error) from error
    return service.execution_to_response(execution)


@router.get(
    "/{assignment_id}/execution/results",
    operation_id="listWorkoutExecutionResults",
    response_model=list[WorkoutExecutionSetResultResponse],
    responses=_BUSINESS_RESPONSES,
)
async def list_workout_execution_results(
    assignment_id: str,
    account: CurrentAccountDep,
    session: SessionDep,
) -> list[WorkoutExecutionSetResultResponse]:
    actor_id = _require_assignment_reader(account)
    actor_role = str(account["role"])
    try:
        results = await results_service.list_results(
            session,
            actor_id,
            actor_role,
            assignment_id,
        )
    except BusinessRuleError as error:
        raise as_http_exception(error) from error
    return [results_service.to_response(result) for result in results]


@router.put(
    "/{assignment_id}/execution/results/{block_position}/{exercise_position}/{set_index}",
    operation_id="putWorkoutExecutionSetResult",
    response_model=WorkoutExecutionSetResultResponse,
    responses=_BUSINESS_RESPONSES,
)
async def put_workout_execution_set_result(
    assignment_id: str,
    block_position: ResultCoordinate,
    exercise_position: ResultCoordinate,
    set_index: ResultCoordinate,
    payload: WorkoutExecutionSetResultUpsertRequest,
    account: CurrentAccountDep,
    session: SessionDep,
) -> WorkoutExecutionSetResultResponse:
    client_id = _require_execution_client(account)
    try:
        result = await results_service.put_result(
            session,
            client_id,
            assignment_id,
            block_position,
            exercise_position,
            set_index,
            payload,
        )
    except BusinessRuleError as error:
        raise as_http_exception(error) from error
    return results_service.to_response(result)


@router.delete(
    "/{assignment_id}/execution/results/{block_position}/{exercise_position}/{set_index}",
    operation_id="deleteWorkoutExecutionSetResult",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    responses=_BUSINESS_RESPONSES,
)
async def delete_workout_execution_set_result(
    assignment_id: str,
    block_position: ResultCoordinate,
    exercise_position: ResultCoordinate,
    set_index: ResultCoordinate,
    account: CurrentAccountDep,
    session: SessionDep,
) -> Response:
    client_id = _require_execution_client(account)
    try:
        await results_service.delete_result(
            session,
            client_id,
            assignment_id,
            block_position,
            exercise_position,
            set_index,
        )
    except BusinessRuleError as error:
        raise as_http_exception(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)
