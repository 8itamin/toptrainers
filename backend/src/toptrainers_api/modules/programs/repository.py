from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from toptrainers_api.modules.programs.models import Program, ProgramAssignment


def _owned_program_query(trainer_id: str, program_id: str):
    return (
        select(Program)
        .where(Program.trainer_id == trainer_id, Program.id == program_id)
        .options(selectinload(Program.slots))
    )


async def list_for_trainer(session: AsyncSession, trainer_id: str) -> Sequence[Program]:
    rows = await session.scalars(
        select(Program)
        .where(Program.trainer_id == trainer_id)
        .options(selectinload(Program.slots))
        .order_by(Program.id)
    )
    return rows.unique().all()


async def get_owned_program(
    session: AsyncSession,
    trainer_id: str,
    program_id: str,
) -> Program | None:
    return await session.scalar(_owned_program_query(trainer_id, program_id))


async def lock_owned_program(
    session: AsyncSession,
    trainer_id: str,
    program_id: str,
) -> Program | None:
    return await session.scalar(
        _owned_program_query(trainer_id, program_id).with_for_update()
    )


async def get_assignment_by_request_id(
    session: AsyncSession, relationship_id: str, request_id: str
) -> ProgramAssignment | None:
    return await session.scalar(
        select(ProgramAssignment).where(
            ProgramAssignment.relationship_id == relationship_id,
            ProgramAssignment.request_id == request_id,
        )
    )


async def get_program_assignment(
    session: AsyncSession, program_assignment_id: str
) -> ProgramAssignment | None:
    return await session.get(ProgramAssignment, program_assignment_id)


async def lock_program_assignment(
    session: AsyncSession, program_assignment_id: str
) -> ProgramAssignment | None:
    return await session.scalar(
        select(ProgramAssignment)
        .where(ProgramAssignment.id == program_assignment_id)
        .with_for_update()
    )
