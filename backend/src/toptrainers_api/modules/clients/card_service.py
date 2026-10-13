from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.errors import BusinessRuleError
from toptrainers_api.modules.clients import card_repository as repo
from toptrainers_api.modules.clients.models import ClientJoinInvitation, TrainerClientCard
from toptrainers_api.modules.clients.repository import get_invitation as read_legacy_invitation
from toptrainers_api.modules.clients.repository import lock_account as lock_legacy_account
from toptrainers_api.modules.clients.schemas import (
    ClientCardPage,
    ClientCardResponse,
    ClientCardWrite,
)


def conflict(code: str, message: str) -> BusinessRuleError:
    return BusinessRuleError(status_code=409, code=code, message=message)


async def prepare_legacy_accept_card(
    session: AsyncSession, actor_id: str, invitation_id: str
) -> None:
    account = await lock_legacy_account(session, actor_id)
    invitation = await read_legacy_invitation(session, invitation_id)
    if (
        account is None
        or invitation is None
        or invitation.client_id != actor_id
        or invitation.status != "PENDING"
    ):
        return  # Existing accept owns the canonical not-found/ownership error.
    card = await repo.find_card_for_account(
        session, invitation.trainer_id, actor_id, account.email.lower()
    )
    if card is None:
        card = TrainerClientCard(
            id=str(uuid4()),
            trainer_id=invitation.trainer_id,
            display_name=account.email[:120],
            contact_email=account.email.lower(),
            client_account_id=actor_id,
        )
        session.add(card)
    elif card.client_account_id not in (None, actor_id):
        raise conflict("CONTACT_EXISTS", "Contact is linked to another account")
    else:
        card.client_account_id = actor_id
    await session.execute(
        update(ClientJoinInvitation)
        .where(ClientJoinInvitation.card_id == card.id, ClientJoinInvitation.status == "PENDING")
        .values(status="CANCELLED")
    )


async def owned_card(
    session: AsyncSession, trainer_id: str, card_id: str, lock: bool = False
) -> TrainerClientCard:
    card = await repo.get_card(session, card_id, lock)
    if card is None or card.trainer_id != trainer_id:
        raise BusinessRuleError(status_code=404, code="CARD_NOT_FOUND", message="Client not found")
    return card


async def card_response(session: AsyncSession, card: TrainerClientCard) -> ClientCardResponse:
    relations = (
        await repo.relationships(session, card.trainer_id, card.client_account_id)
        if card.client_account_id
        else []
    )
    active = next((r for r in relations if r.status == "ACTIVE"), None)
    return ClientCardResponse(
        id=card.id,
        display_name=card.display_name,
        contact_email=card.contact_email,
        client_account_id=card.client_account_id,
        relationship_id=active.id if active else None,
        group="active" if active else "past" if relations else "pending",
        created_at=card.created_at,
    )


async def create_card(
    session: AsyncSession, trainer_id: str, payload: ClientCardWrite
) -> ClientCardResponse:
    card = TrainerClientCard(
        id=str(uuid4()),
        trainer_id=trainer_id,
        display_name=payload.display_name,
        contact_email=str(payload.contact_email) if payload.contact_email else None,
    )
    session.add(card)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise conflict("CONTACT_EXISTS", "A client with this email already exists") from None
    await session.refresh(card)
    return await card_response(session, card)


async def update_card(
    session: AsyncSession, trainer_id: str, card_id: str, payload: ClientCardWrite
) -> ClientCardResponse:
    card = await owned_card(session, trainer_id, card_id, True)
    email = str(payload.contact_email) if payload.contact_email else None
    if email != card.contact_email:
        invitation = await session.scalar(
            select(ClientJoinInvitation).where(
                ClientJoinInvitation.card_id == card.id,
                ClientJoinInvitation.status == "PENDING",
                ClientJoinInvitation.expires_at > datetime.now(UTC),
            )
        )
        if card.client_account_id or invitation:
            raise conflict("CONTACT_EMAIL_LOCKED", "Cancel the invitation before changing email")
    card.display_name, card.contact_email = payload.display_name, email
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise conflict("CONTACT_EXISTS", "A client with this email already exists") from None
    await session.refresh(card)
    return await card_response(session, card)


async def list_cards(
    session: AsyncSession, trainer_id: str, group: str, query: str, cursor: str | None, limit: int
) -> ClientCardPage:
    rows, counts = await repo.list_card_projections(
        session, trainer_id, group, query, cursor, limit
    )
    page = [
        ClientCardResponse(
            id=row.card.id,
            display_name=row.card.display_name,
            contact_email=row.card.contact_email,
            client_account_id=row.card.client_account_id,
            relationship_id=row.relationship_id,
            group=row.group,
            created_at=row.card.created_at,
        )
        for row in rows[:limit]
    ]
    return ClientCardPage(
        items=page, counts=counts, next_cursor=page[-1].id if len(rows) > limit else None
    )
