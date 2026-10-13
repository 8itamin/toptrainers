from datetime import date, datetime

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.errors import BusinessRuleError, as_http_exception
from toptrainers_api.modules.assignments.models import WorkoutAssignment, WorkoutExecution
from toptrainers_api.modules.clients import service as clients
from toptrainers_api.modules.clients.http import CurrentAccountDep, SessionDep
from toptrainers_api.modules.clients.http import require_role as _require_role
from toptrainers_api.modules.programs.models import ProgramAssignment

router = APIRouter(tags=["assignments"])


class ClientProgramSummary(BaseModel):
    id: str
    title: str
    start_date: date
    status: str
    completed: int
    total: int
    completion: int | None


class TrainerClientSummary(BaseModel):
    programs: list[ClientProgramSummary]
    completed_workouts: int
    last_completed_at: datetime | None


def completion_percent(completed: int, total: int) -> int | None:
    return round(100 * completed / total) if total else None


async def get_trainer_client_summary(
    session: AsyncSession, trainer_id: str, client_id: str
) -> TrainerClientSummary:
    relationships = await clients.list_relationships_for_trainer_client(
        session, trainer_id, client_id
    )
    if not relationships:
        raise BusinessRuleError(
            status_code=404, code="CLIENT_NOT_FOUND", message="Client not found"
        )
    ids = [r.id for r in relationships]
    workouts = list(
        await session.scalars(
            select(WorkoutAssignment).where(WorkoutAssignment.relationship_id.in_(ids))
        )
    )
    programs = list(
        await session.scalars(
            select(ProgramAssignment)
            .where(ProgramAssignment.relationship_id.in_(ids))
            .order_by(ProgramAssignment.created_at.desc())
        )
    )
    completed_ids = [w.id for w in workouts if w.status == "COMPLETED"]
    times = list(
        await session.scalars(
            select(WorkoutExecution.completed_at).where(
                WorkoutExecution.assignment_id.in_(completed_ids),
                WorkoutExecution.completed_at.is_not(None),
            )
        )
    )
    summaries = []
    for p in programs:
        children = [
            w for w in workouts if w.program_assignment_id == p.id and w.status != "CANCELLED"
        ]
        completed = sum(w.status == "COMPLETED" for w in children)
        summaries.append(
            ClientProgramSummary(
                id=p.id,
                title=str(p.program_snapshot.get("title", "Программа")),
                start_date=p.start_date,
                status=p.status,
                completed=completed,
                total=len(children),
                completion=completion_percent(completed, len(children)),
            )
        )
    return TrainerClientSummary(
        programs=summaries,
        completed_workouts=len(times),
        last_completed_at=max(t for t in times if t is not None) if times else None,
    )


@router.get("/clients/{client_id}/training-summary", response_model=TrainerClientSummary)
async def training_summary(
    client_id: str, account: CurrentAccountDep, session: SessionDep
) -> TrainerClientSummary:
    _require_role(account, "trainer")
    try:
        return await get_trainer_client_summary(session, str(account["sub"]), client_id)
    except BusinessRuleError as error:
        raise as_http_exception(error) from error
