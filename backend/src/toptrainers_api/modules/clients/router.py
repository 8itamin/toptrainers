from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.auth import current_account
from toptrainers_api.core.db import get_session
from toptrainers_api.core.errors import (
    BusinessErrorResponse,
    BusinessRuleError,
    as_http_exception,
)
from toptrainers_api.modules.clients import service
from toptrainers_api.modules.clients.schemas import (
    CreateInvitationRequest,
    InvitationResponse,
    RelationshipResponse,
)

router = APIRouter(prefix="/clients", tags=["clients"])

CurrentAccountDep = Annotated[dict[str, object], Depends(current_account)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]

_BUSINESS_RESPONSES: dict[int | str, dict[str, Any]] = {
    403: {"model": BusinessErrorResponse},
    404: {"model": BusinessErrorResponse},
    409: {"model": BusinessErrorResponse},
}


def _require_role(account: dict[str, object], *roles: str) -> None:
    if account.get("role") not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ROLE_NOT_ALLOWED",
                "message": "This role cannot perform the requested operation",
            },
        )


@router.post(
    "/invitations",
    response_model=InvitationResponse,
    status_code=status.HTTP_201_CREATED,
    responses=_BUSINESS_RESPONSES,
)
async def create_invitation(
    payload: CreateInvitationRequest,
    account: CurrentAccountDep,
    session: SessionDep,
) -> InvitationResponse:
    _require_role(account, "trainer")
    try:
        invitation = await service.create_invitation(
            session, str(account["sub"]), payload.client_id
        )
    except BusinessRuleError as error:
        raise as_http_exception(error) from error
    return InvitationResponse.model_validate(invitation)


@router.post(
    "/invitations/{invitation_id}/accept",
    response_model=RelationshipResponse,
    responses=_BUSINESS_RESPONSES,
)
async def accept_invitation(
    invitation_id: str,
    account: CurrentAccountDep,
    session: SessionDep,
) -> RelationshipResponse:
    _require_role(account, "client")
    try:
        relationship = await service.accept_invitation(
            session, str(account["sub"]), invitation_id
        )
    except BusinessRuleError as error:
        raise as_http_exception(error) from error
    return RelationshipResponse.model_validate(relationship)


@router.post(
    "/invitations/{invitation_id}/reject",
    response_model=InvitationResponse,
    responses=_BUSINESS_RESPONSES,
)
async def reject_invitation(
    invitation_id: str,
    account: CurrentAccountDep,
    session: SessionDep,
) -> InvitationResponse:
    _require_role(account, "client")
    try:
        invitation = await service.reject_invitation(session, str(account["sub"]), invitation_id)
    except BusinessRuleError as error:
        raise as_http_exception(error) from error
    return InvitationResponse.model_validate(invitation)


@router.post(
    "/invitations/{invitation_id}/cancel",
    response_model=InvitationResponse,
    responses=_BUSINESS_RESPONSES,
)
async def cancel_invitation(
    invitation_id: str,
    account: CurrentAccountDep,
    session: SessionDep,
) -> InvitationResponse:
    _require_role(account, "trainer")
    try:
        invitation = await service.cancel_invitation(session, str(account["sub"]), invitation_id)
    except BusinessRuleError as error:
        raise as_http_exception(error) from error
    return InvitationResponse.model_validate(invitation)


@router.post(
    "/relationships/{relationship_id}/terminate",
    response_model=RelationshipResponse,
    responses=_BUSINESS_RESPONSES,
)
async def terminate_relationship(
    relationship_id: str,
    account: CurrentAccountDep,
    session: SessionDep,
) -> RelationshipResponse:
    _require_role(account, "trainer", "client")
    try:
        relationship = await service.terminate_relationship(
            session, str(account["sub"]), relationship_id
        )
    except BusinessRuleError as error:
        raise as_http_exception(error) from error
    return RelationshipResponse.model_validate(relationship)
