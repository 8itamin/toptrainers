from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.auth import current_account
from toptrainers_api.core.db import get_session

CurrentAccountDep = Annotated[dict[str, object], Depends(current_account)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


def require_role(account: dict[str, object], *roles: str) -> None:
    if account.get("role") not in roles:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "ROLE_NOT_ALLOWED",
                "message": "This role cannot perform the requested operation",
            },
        )
