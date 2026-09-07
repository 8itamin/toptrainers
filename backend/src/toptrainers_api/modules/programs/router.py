from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.auth import current_account
from toptrainers_api.core.db import get_session
from toptrainers_api.modules.programs import service
from toptrainers_api.modules.programs.schemas import (
    IssueProgramRequest,
    ProgramAssignmentResponse,
    ProgramCreate,
    ProgramResponse,
)

router = APIRouter(prefix="/programs", tags=["programs"])


@router.get("", response_model=list[ProgramResponse])
async def list_programs(
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> list[ProgramResponse]:
    programs = await service.list_programs(session, account)
    return [service.to_response(program) for program in programs]


@router.post("", response_model=ProgramResponse, status_code=201)
async def create_program(
    payload: ProgramCreate,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> ProgramResponse:
    return service.to_response(await service.create_program(session, account, payload))


@router.put("/{program_id}", response_model=ProgramResponse)
async def replace_program(
    program_id: str,
    payload: ProgramCreate,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> ProgramResponse:
    return service.to_response(
        await service.replace_program(session, account, program_id, payload)
    )


@router.post("/{program_id}/assignments", response_model=ProgramAssignmentResponse, status_code=201)
async def issue_program(
    program_id: str,
    payload: IssueProgramRequest,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> ProgramAssignmentResponse:
    return service.program_assignment_to_response(
        await service.issue_program(session, account, program_id, payload)
    )
