from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.auth import current_account
from toptrainers_api.core.db import get_session
from toptrainers_api.modules.exercises.service import require_trainer
from toptrainers_api.modules.media.schemas import MediaReadUrlResponse
from toptrainers_api.modules.media.storage import PrivateS3Storage
from toptrainers_api.modules.tasks import service
from toptrainers_api.modules.tasks.schemas import (
    SubmitTaskResultRequest,
    TaskAssignmentResponse,
    TaskResultVersionResponse,
    TaskTemplateResponse,
    TaskTemplateWrite,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])
ScheduledDate = Annotated[date, Query()]


def _storage() -> PrivateS3Storage:
    return PrivateS3Storage()


@router.get(
    "/templates",
    response_model=list[TaskTemplateResponse],
    operation_id="listTaskTemplates",
)
async def list_task_templates(
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> list[TaskTemplateResponse]:
    templates = await service.list_task_templates(session, require_trainer(account))
    return [service.task_template_to_response(template) for template in templates]


@router.get(
    "/assignments",
    response_model=list[TaskAssignmentResponse],
    operation_id="listClientTaskAssignmentsByDate",
)
async def list_client_task_assignments_by_date(
    scheduled_date: ScheduledDate,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> list[TaskAssignmentResponse]:
    assignments = await service.list_client_task_assignments_by_date(
        session, str(account["sub"]), scheduled_date
    )
    return [service.task_assignment_to_response(assignment) for assignment in assignments]


@router.post(
    "/templates",
    response_model=TaskTemplateResponse,
    status_code=201,
    operation_id="createTaskTemplate",
)
async def create_task_template(
    payload: TaskTemplateWrite,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> TaskTemplateResponse:
    template = await service.create_task_template(session, require_trainer(account), payload)
    return service.task_template_to_response(template)


@router.post(
    "/assignments/{assignment_id}/results",
    response_model=TaskResultVersionResponse,
    status_code=201,
    operation_id="submitTaskResult",
)
async def submit_task_result(
    assignment_id: str,
    payload: SubmitTaskResultRequest,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> TaskResultVersionResponse:
    result = await service.submit_task_result(
        session, str(account["sub"]), assignment_id, payload
    )
    return service.task_result_to_response(result)


@router.get(
    "/assignments/{assignment_id}/results",
    response_model=list[TaskResultVersionResponse],
    operation_id="listTaskResultVersions",
)
async def list_task_results(
    assignment_id: str,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> list[TaskResultVersionResponse]:
    results = await service.list_task_results(session, str(account["sub"]), assignment_id)
    return [service.task_result_to_response(result) for result in results]


@router.post(
    "/assignments/{assignment_id}/results/media/{media_id}/read-url",
    response_model=MediaReadUrlResponse,
    operation_id="createTaskResultMediaReadUrl",
)
async def create_result_media_read_url(
    assignment_id: str,
    media_id: str,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> MediaReadUrlResponse:
    read_url = await service.create_result_media_read_url(
        session, str(account["sub"]), assignment_id, media_id, _storage()
    )
    return MediaReadUrlResponse(
        media_id=media_id,
        read_url=read_url,
        expires_in_seconds=300,
    )
