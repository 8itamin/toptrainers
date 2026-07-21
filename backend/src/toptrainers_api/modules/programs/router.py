from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.auth import current_account
from toptrainers_api.core.db import get_session
from toptrainers_api.modules.programs.models import Program
from toptrainers_api.modules.programs.schemas import ProgramCreate, ProgramResponse

router = APIRouter(prefix="/programs", tags=["programs"])


@router.get("", response_model=list[ProgramResponse])
async def list_programs(account: dict[str, object] = Depends(current_account), session: AsyncSession = Depends(get_session)) -> list[ProgramResponse]:
    rows = await session.scalars(select(Program).where(Program.trainer_id == str(account["sub"])).order_by(Program.id))
    return [ProgramResponse.model_validate(row, from_attributes=True) for row in rows]


@router.post("", response_model=ProgramResponse, status_code=201)
async def create_program(payload: ProgramCreate, account: dict[str, object] = Depends(current_account), session: AsyncSession = Depends(get_session)) -> ProgramResponse:
    if account.get("role") != "trainer":
        raise HTTPException(status_code=403, detail="Trainer role required")
    program = Program(id=str(uuid4()), trainer_id=str(account["sub"]), **payload.model_dump())
    session.add(program)
    await session.commit()
    await session.refresh(program)
    return ProgramResponse.model_validate(program, from_attributes=True)
