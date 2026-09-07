from datetime import date, timedelta
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.modules.assignments.service import (
    cancel_planned_for_program_assignment,
    materialize_assignment,
)
from toptrainers_api.modules.clients import service as clients_service
from toptrainers_api.modules.exercises.service import require_trainer
from toptrainers_api.modules.programs import repository
from toptrainers_api.modules.programs.models import (
    Program,
    ProgramAssignment,
    ProgramAssignmentStatus,
    ProgramSlot,
)
from toptrainers_api.modules.programs.schemas import (
    IssueProgramRequest,
    ProgramAssignmentResponse,
    ProgramCreate,
    ProgramResponse,
    ProgramSlotResponse,
)
from toptrainers_api.modules.workouts import service as workouts_service


def to_response(program: Program) -> ProgramResponse:
    return ProgramResponse(
        id=program.id,
        trainer_id=program.trainer_id,
        title=program.title,
        description=program.description,
        duration_weeks=program.duration_weeks,
        slots=[
            ProgramSlotResponse(
                id=slot.id,
                week_number=slot.week_number,
                day_number=slot.day_number,
                workout_id=slot.workout_id,
            )
            for slot in program.slots
        ],
    )


def scheduled_date_for_slot(start_date: date, slot: ProgramSlot) -> date:
    return start_date + timedelta(days=(slot.week_number - 1) * 7 + (slot.day_number - 1))


def _program_snapshot_v1(program: Program) -> dict[str, object]:
    return {
        "schema_version": 1,
        "program_id": program.id,
        "title": program.title,
        "description": program.description,
        "duration_weeks": program.duration_weeks,
        "slots": [
            {
                "slot_id": slot.id,
                "week_number": slot.week_number,
                "day_number": slot.day_number,
                "workout_id": slot.workout_id,
            }
            for slot in program.slots
        ],
    }


def program_assignment_to_response(parent: ProgramAssignment) -> ProgramAssignmentResponse:
    return ProgramAssignmentResponse(
        id=parent.id,
        program_id=parent.program_id,
        relationship_id=parent.relationship_id,
        request_id=parent.request_id,
        start_date=parent.start_date,
        status=parent.status,
        snapshot_schema_version=parent.snapshot_schema_version,
        program_snapshot=parent.program_snapshot,
        created_at=parent.created_at,
        updated_at=parent.updated_at,
    )


async def issue_program(
    session: AsyncSession,
    account: dict[str, object],
    program_id: str,
    payload: IssueProgramRequest,
) -> ProgramAssignment:
    trainer_id = require_trainer(account)
    relationship = await clients_service.lock_active_relationship_for_trainer_client(
        session, trainer_id, payload.client_id
    )
    if relationship is None:
        raise HTTPException(
            status_code=409,
            detail="An active trainer-client relationship is required",
        )
    program = await repository.lock_owned_program(session, trainer_id, program_id)
    if program is None:
        raise HTTPException(status_code=404, detail="Program was not found")
    existing = await repository.get_assignment_by_request_id(
        session, relationship.id, payload.request_id
    )
    if existing is not None:
        if existing.program_id != program_id or existing.start_date != payload.start_date:
            raise HTTPException(
                status_code=409,
                detail="request_id was already used for a different Program assignment",
            )
        return existing
    if not program.slots:
        raise HTTPException(status_code=409, detail="An empty Program cannot be assigned")
    parent = ProgramAssignment(
        id=str(uuid4()), program_id=program.id, relationship_id=relationship.id,
        request_id=payload.request_id, start_date=payload.start_date,
        program_snapshot=_program_snapshot_v1(program), snapshot_schema_version=1,
        status=ProgramAssignmentStatus.ISSUED.value,
    )
    session.add(parent)
    for slot in program.slots:
        await materialize_assignment(
            session, relationship, trainer_id, slot.workout_id,
            f"program:{parent.id}:{slot.id}", scheduled_date_for_slot(payload.start_date, slot),
            program_assignment_id=parent.id, program_slot_id=slot.id,
        )
    await session.commit()
    await session.refresh(parent)
    return parent


async def cancel_program_assignment(
    session: AsyncSession,
    account: dict[str, object],
    program_assignment_id: str,
) -> ProgramAssignment:
    trainer_id = require_trainer(account)
    existing = await repository.get_program_assignment(session, program_assignment_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Program assignment was not found")
    relationship = await clients_service.lock_relationship_with_client(
        session,
        existing.relationship_id,
    )
    if relationship is None or relationship.trainer_id != trainer_id:
        raise HTTPException(status_code=404, detail="Program assignment was not found")
    parent = await repository.lock_program_assignment(session, program_assignment_id)
    if parent is None:
        raise HTTPException(status_code=404, detail="Program assignment was not found")
    if parent.status == ProgramAssignmentStatus.ISSUED.value:
        await cancel_planned_for_program_assignment(session, parent.id)
        parent.status = ProgramAssignmentStatus.CANCELLED.value
        await session.commit()
        await session.refresh(parent)
    return parent


async def _require_owned_workouts(
    session: AsyncSession,
    trainer_id: str,
    payload: ProgramCreate,
) -> None:
    for workout_id in {slot.workout_id for slot in payload.slots}:
        if await workouts_service.get_owned_workout(session, trainer_id, workout_id) is None:
            raise HTTPException(
                status_code=422,
                detail="Every program slot workout must belong to the trainer",
            )


def _slots(payload: ProgramCreate) -> list[ProgramSlot]:
    return [
        ProgramSlot(
            id=str(uuid4()),
            week_number=slot.week_number,
            day_number=slot.day_number,
            workout_id=slot.workout_id,
        )
        for slot in payload.slots
    ]


async def list_programs(session: AsyncSession, account: dict[str, object]) -> list[Program]:
    return list(await repository.list_for_trainer(session, require_trainer(account)))


async def create_program(
    session: AsyncSession,
    account: dict[str, object],
    payload: ProgramCreate,
) -> Program:
    trainer_id = require_trainer(account)
    await _require_owned_workouts(session, trainer_id, payload)
    program = Program(
        id=str(uuid4()),
        trainer_id=trainer_id,
        title=payload.title,
        description=payload.description,
        duration_weeks=payload.duration_weeks,
        slots=_slots(payload),
    )
    session.add(program)
    await session.commit()
    saved = await repository.get_owned_program(session, trainer_id, program.id)
    if saved is None:
        raise RuntimeError("Created Program was not found")
    return saved


async def replace_program(
    session: AsyncSession,
    account: dict[str, object],
    program_id: str,
    payload: ProgramCreate,
) -> Program:
    trainer_id = require_trainer(account)
    program = await repository.lock_owned_program(session, trainer_id, program_id)
    if program is None:
        raise HTTPException(status_code=404, detail="Program was not found")
    await _require_owned_workouts(session, trainer_id, payload)
    program.title = payload.title
    program.description = payload.description
    program.duration_weeks = payload.duration_weeks
    program.slots[:] = _slots(payload)
    await session.commit()
    saved = await repository.get_owned_program(session, trainer_id, program_id)
    if saved is None:
        raise RuntimeError("Updated Program was not found")
    return saved
