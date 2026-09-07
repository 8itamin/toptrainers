from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.auth import current_account
from toptrainers_api.core.db import get_session
from toptrainers_api.modules.programs import service
from toptrainers_api.modules.programs.schemas import ProgramAssignmentResponse

router = APIRouter(prefix="/program-assignments", tags=["program-assignments"])


@router.post("/{program_assignment_id}/cancel", response_model=ProgramAssignmentResponse)
async def cancel_program_assignment(
    program_assignment_id: str,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> ProgramAssignmentResponse:
    return service.program_assignment_to_response(
        await service.cancel_program_assignment(session, account, program_assignment_id)
    )
