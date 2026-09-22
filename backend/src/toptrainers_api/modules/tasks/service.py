from __future__ import annotations

from datetime import date
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.modules.clients import service as clients_service
from toptrainers_api.modules.clients.models import RelationshipStatus
from toptrainers_api.modules.media import service as media_service
from toptrainers_api.modules.media.storage import PrivateS3Storage
from toptrainers_api.modules.tasks import repository
from toptrainers_api.modules.tasks.models import TaskAssignment, TaskResultVersion, TaskTemplate
from toptrainers_api.modules.tasks.schemas import (
    SubmitTaskResultRequest,
    TaskAssignmentResponse,
    TaskResultVersionResponse,
    TaskTemplateResponse,
    TaskTemplateWrite,
)


def task_template_to_response(template: TaskTemplate) -> TaskTemplateResponse:
    return TaskTemplateResponse(
        id=template.id,
        trainer_id=template.trainer_id,
        title=template.title,
        instruction=template.instruction,
        result_schema=template.result_schema,
    )


async def list_task_templates(
    session: AsyncSession,
    trainer_id: str,
) -> list[TaskTemplate]:
    return list(await repository.list_for_trainer(session, trainer_id))


async def create_task_template(
    session: AsyncSession,
    trainer_id: str,
    payload: TaskTemplateWrite,
) -> TaskTemplate:
    template = TaskTemplate(
        id=str(uuid4()),
        trainer_id=trainer_id,
        title=payload.title,
        instruction=payload.instruction,
        result_schema={
            "schema_version": 1,
            "fields": [field.model_dump(mode="json") for field in payload.result_fields],
        },
    )
    session.add(template)
    await session.commit()
    await session.refresh(template)
    return template


def build_task_snapshot_v1(template: TaskTemplate) -> dict[str, object]:
    return {
        "schema_version": 1,
        "source_task_template_id": template.id,
        "title": template.title,
        "instruction": template.instruction,
        "result_schema": template.result_schema,
    }


def materialize_task_assignment(
    template: TaskTemplate,
    *,
    relationship_id: str,
    scheduled_date: date,
    program_assignment_id: str | None = None,
    program_slot_id: str | None = None,
) -> TaskAssignment:
    return TaskAssignment(
        id=str(uuid4()),
        relationship_id=relationship_id,
        source_task_template_id=template.id,
        program_assignment_id=program_assignment_id,
        program_slot_id=program_slot_id,
        scheduled_date=scheduled_date,
        task_snapshot=build_task_snapshot_v1(template),
        status="PENDING",
    )


async def get_owned_task_template(
    session: AsyncSession,
    trainer_id: str,
    task_template_id: str,
) -> TaskTemplate | None:
    """Public cross-module contract for trainer-owned task templates."""
    return await repository.get_owned_template(session, trainer_id, task_template_id)


async def cancel_pending_for_program_assignment(
    session: AsyncSession,
    program_assignment_id: str,
) -> None:
    """Cancel only pending task children within the caller-owned transaction."""
    await repository.cancel_pending_for_program_assignment(session, program_assignment_id)


def task_result_to_response(result: TaskResultVersion) -> TaskResultVersionResponse:
    return TaskResultVersionResponse(
        assignment_id=result.assignment_id,
        version=result.version,
        request_id=result.request_id,
        result_payload=result.result_payload,
        created_at=result.created_at,
    )


def task_assignment_to_response(assignment: TaskAssignment) -> TaskAssignmentResponse:
    return TaskAssignmentResponse(
        id=assignment.id,
        relationship_id=assignment.relationship_id,
        source_task_template_id=assignment.source_task_template_id,
        scheduled_date=assignment.scheduled_date,
        task_snapshot=assignment.task_snapshot,
        status=assignment.status,
    )


def _result_payload(
    assignment: TaskAssignment,
    payload: SubmitTaskResultRequest,
) -> dict[str, object]:
    result_schema = assignment.task_snapshot.get("result_schema")
    if not isinstance(result_schema, dict):
        raise RuntimeError("Task snapshot has an invalid result schema")
    fields = result_schema.get("fields", [])
    if not isinstance(fields, list):
        raise RuntimeError("Task snapshot has an invalid result schema")
    configured = {
        field["kind"]: bool(field.get("required"))
        for field in fields
        if isinstance(field, dict) and isinstance(field.get("kind"), str)
    }
    supplied = {
        "measurement": payload.measurement_value is not None,
        "completion": payload.completed is not None,
        "note": payload.note is not None,
        "photo": bool(payload.photo_media_ids),
    }
    unsupported = [kind for kind, present in supplied.items() if present and kind not in configured]
    missing = [kind for kind, required in configured.items() if required and not supplied.get(kind)]
    if unsupported:
        raise HTTPException(
            status_code=422,
            detail="Result contains a field not enabled by the task",
        )
    if missing:
        raise HTTPException(
            status_code=422,
            detail="Result is missing a required task field",
        )
    return {
        "schema_version": 1,
        "measurement_value": payload.measurement_value,
        "completed": payload.completed,
        "note": payload.note,
        "photo_media_ids": payload.photo_media_ids,
    }


async def submit_task_result(
    session: AsyncSession,
    client_id: str,
    assignment_id: str,
    payload: SubmitTaskResultRequest,
) -> TaskResultVersion:
    assignment = await repository.get_assignment_for_update(session, assignment_id)
    if assignment is None:
        raise HTTPException(status_code=404, detail="Task assignment was not found")
    relationship = await clients_service.lock_relationship_with_client(
        session, assignment.relationship_id
    )
    if relationship is None or relationship.client_id != client_id:
        raise HTTPException(status_code=404, detail="Task assignment was not found")
    if relationship.status != RelationshipStatus.ACTIVE.value:
        raise HTTPException(status_code=409, detail="An active relationship is required")
    if assignment.status == "CANCELLED":
        raise HTTPException(status_code=409, detail="A cancelled task cannot receive results")
    result_payload = _result_payload(assignment, payload)
    for media_id in payload.photo_media_ids:
        if await media_service.get_ready_owned_media(session, client_id, media_id) is None:
            raise HTTPException(
                status_code=422,
                detail="Every result photo must be uploaded and confirmed",
            )
    existing = await repository.get_result_by_request_id(
        session, assignment.id, payload.request_id
    )
    if existing is not None:
        if existing.result_payload != result_payload:
            raise HTTPException(
                status_code=409,
                detail="request_id was already used for another result",
            )
        return existing
    result = TaskResultVersion(
        assignment_id=assignment.id,
        version=await repository.next_result_version(session, assignment.id),
        request_id=payload.request_id,
        result_payload=result_payload,
    )
    assignment.status = "COMPLETED"
    session.add(result)
    await session.commit()
    await session.refresh(result)
    return result


async def list_task_results(
    session: AsyncSession,
    actor_id: str,
    assignment_id: str,
) -> list[TaskResultVersion]:
    assignment = await repository.get_assignment(session, assignment_id)
    if assignment is None:
        raise HTTPException(status_code=404, detail="Task assignment was not found")
    relationship = await clients_service.get_relationship(session, assignment.relationship_id)
    if relationship is None or actor_id not in {relationship.client_id, relationship.trainer_id}:
        raise HTTPException(status_code=404, detail="Task assignment was not found")
    return await repository.list_result_versions(session, assignment_id)


async def list_client_task_assignments_by_date(
    session: AsyncSession,
    client_id: str,
    scheduled_date: date,
) -> list[TaskAssignment]:
    relationships = await clients_service.list_relationships_for_client(session, client_id)
    return await repository.list_for_relationships_and_date(
        session, [relationship.id for relationship in relationships], scheduled_date
    )


async def create_result_media_read_url(
    session: AsyncSession,
    actor_id: str,
    assignment_id: str,
    media_id: str,
    storage: PrivateS3Storage,
) -> str:
    results = await list_task_results(session, actor_id, assignment_id)
    if not any(
        _result_references_media(result.result_payload, media_id) for result in results
    ):
        raise HTTPException(status_code=404, detail="Task result media was not found")
    return await media_service.create_authorized_read_url(session, media_id, storage)


def _result_references_media(result_payload: dict[str, object], media_id: str) -> bool:
    photo_media_ids = result_payload.get("photo_media_ids")
    return isinstance(photo_media_ids, list) and media_id in photo_media_ids
