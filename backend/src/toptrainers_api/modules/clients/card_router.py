import logging
from html import escape
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from redis.asyncio import Redis

from toptrainers_api.core.errors import BusinessRuleError, as_http_exception
from toptrainers_api.core.mail import send_email
from toptrainers_api.core.redis import get_redis
from toptrainers_api.modules.clients import card_service, join_service
from toptrainers_api.modules.clients.http import CurrentAccountDep, SessionDep
from toptrainers_api.modules.clients.http import require_role as _require_role
from toptrainers_api.modules.clients.schemas import (
    ClientCardPage,
    ClientCardResponse,
    ClientCardWrite,
    IssuedJoinInvitation,
    JoinPreview,
    JoinTokenRequest,
    RelationshipResponse,
)
from toptrainers_api.modules.identity.service import enforce_rate_limit

router = APIRouter(tags=["clients"])
RedisDep = Annotated[Redis, Depends(get_redis)]
logger = logging.getLogger(__name__)


@router.get("/cards", response_model=ClientCardPage)
async def list_cards(
    account: CurrentAccountDep,
    session: SessionDep,
    group: Literal["all", "active", "pending", "past"] = "all",
    query: str = "",
    cursor: str | None = None,
    limit: int = Query(default=30, ge=1, le=100),
) -> ClientCardPage:
    _require_role(account, "trainer")
    return await card_service.list_cards(session, str(account["sub"]), group, query, cursor, limit)


@router.post("/cards", response_model=ClientCardResponse, status_code=201)
async def create_card(
    payload: ClientCardWrite, account: CurrentAccountDep, session: SessionDep
) -> ClientCardResponse:
    _require_role(account, "trainer")
    try:
        return await card_service.create_card(session, str(account["sub"]), payload)
    except BusinessRuleError as error:
        raise as_http_exception(error) from error


@router.get("/cards/{card_id}", response_model=ClientCardResponse)
async def get_card(
    card_id: str, account: CurrentAccountDep, session: SessionDep
) -> ClientCardResponse:
    _require_role(account, "trainer")
    try:
        card = await card_service.owned_card(session, str(account["sub"]), card_id)
        return await card_service.card_response(session, card)
    except BusinessRuleError as error:
        raise as_http_exception(error) from error


@router.patch("/cards/{card_id}", response_model=ClientCardResponse)
async def update_card(
    card_id: str, payload: ClientCardWrite, account: CurrentAccountDep, session: SessionDep
) -> ClientCardResponse:
    _require_role(account, "trainer")
    try:
        return await card_service.update_card(session, str(account["sub"]), card_id, payload)
    except BusinessRuleError as error:
        raise as_http_exception(error) from error


async def issue(
    card_id: str, account: CurrentAccountDep, session: SessionDep, request: Request, redis: Redis
) -> IssuedJoinInvitation:
    _require_role(account, "trainer")
    await enforce_rate_limit(
        redis, request, "client-invite", f"{account['sub']}:{card_id}", 5, 3600
    )
    return await join_service.issue_join_invitation(session, str(account["sub"]), card_id)


@router.post("/cards/{card_id}/invite", response_model=IssuedJoinInvitation)
async def invite(
    card_id: str, account: CurrentAccountDep, session: SessionDep, request: Request, redis: RedisDep
) -> IssuedJoinInvitation:
    try:
        return await issue(card_id, account, session, request, redis)
    except BusinessRuleError as error:
        raise as_http_exception(error) from error


@router.post("/cards/{card_id}/invite/email", response_model=IssuedJoinInvitation)
async def email_invite(
    card_id: str, account: CurrentAccountDep, session: SessionDep, request: Request, redis: RedisDep
) -> IssuedJoinInvitation:
    _require_role(account, "trainer")
    try:
        card = await card_service.owned_card(session, str(account["sub"]), card_id, True)
        if not card.contact_email:
            raise card_service.conflict("EMAIL_REQUIRED", "Add email before sending")
        recipient, name = card.contact_email, card.display_name
        result = await issue(card_id, account, session, request, redis)
        try:
            await send_email(
                recipient,
                "Приглашение в TopTrainers",
                f"<p>{escape(name)}, тренер приглашает вас в TopTrainers.</p>"
                f'<p><a href="{escape(result.url, quote=True)}">Принять приглашение</a></p>'
                "<p>Ссылка действует 7 дней. Войдите или зарегистрируйтесь как клиент.</p>",
            )
            result.delivery_status = "SENT"
        except (OSError, RuntimeError):
            # Do not log recipients, message contents or SMTP credentials.
            logger.warning("Client invitation delivery failed")
            result.delivery_status = "FAILED"
        return result
    except BusinessRuleError as error:
        raise as_http_exception(error) from error


@router.post("/cards/{card_id}/invite/cancel", status_code=204)
async def cancel_invite(card_id: str, account: CurrentAccountDep, session: SessionDep) -> Response:
    _require_role(account, "trainer")
    try:
        await join_service.cancel_join_invitation(session, str(account["sub"]), card_id)
    except BusinessRuleError as error:
        raise as_http_exception(error) from error
    return Response(status_code=204)


@router.post("/join/preview", response_model=JoinPreview)
async def preview(
    payload: JoinTokenRequest, session: SessionDep, request: Request, redis: RedisDep
) -> JoinPreview:
    await enforce_rate_limit(redis, request, "client-join-preview", "preview", 30, 900)
    try:
        return await join_service.preview_join_invitation(session, payload.token)
    except BusinessRuleError as error:
        raise as_http_exception(error) from error


@router.post("/join/accept", response_model=RelationshipResponse)
async def accept(
    payload: JoinTokenRequest,
    account: CurrentAccountDep,
    session: SessionDep,
    request: Request,
    redis: RedisDep,
) -> RelationshipResponse:
    _require_role(account, "client")
    await enforce_rate_limit(redis, request, "client-join-accept", str(account["sub"]), 30, 900)
    try:
        result = await join_service.accept_join_invitation(
            session, str(account["sub"]), payload.token
        )
        return RelationshipResponse.model_validate(result)
    except BusinessRuleError as error:
        raise as_http_exception(error) from error
