import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.config import settings
from toptrainers_api.core.errors import BusinessRuleError
from toptrainers_api.modules.clients import card_repository as repo
from toptrainers_api.modules.clients import repository
from toptrainers_api.modules.clients.card_service import conflict, owned_card
from toptrainers_api.modules.clients.models import (
    ClientJoinInvitation,
    TrainerClientCard,
    TrainerClientInvitation,
    TrainerClientRelationship,
)
from toptrainers_api.modules.clients.schemas import IssuedJoinInvitation, JoinPreview
from toptrainers_api.modules.identity.service import lock_account_for_client_join


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def validate_join(invitation: ClientJoinInvitation | None) -> ClientJoinInvitation:
    if (
        invitation is None
        or invitation.status != "PENDING"
        or invitation.expires_at <= datetime.now(UTC)
    ):
        raise conflict("INVITATION_UNAVAILABLE", "Invitation expired or cancelled")
    return invitation


async def issue_join_invitation(
    session: AsyncSession, trainer_id: str, card_id: str
) -> IssuedJoinInvitation:
    card = await owned_card(session, trainer_id, card_id, True)
    if card.client_account_id:
        relations = await repo.relationships(session, trainer_id, card.client_account_id)
        if any(r.status == "ACTIVE" for r in relations):
            raise conflict("ACTIVE_RELATIONSHIP_EXISTS", "Client already connected")
    await session.execute(
        update(ClientJoinInvitation)
        .where(ClientJoinInvitation.card_id == card_id, ClientJoinInvitation.status == "PENDING")
        .values(status="CANCELLED")
    )
    token = secrets.token_urlsafe(32)
    invitation = ClientJoinInvitation(
        id=str(uuid4()),
        card_id=card_id,
        token_hash=token_hash(token),
        status="PENDING",
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )
    session.add(invitation)
    await session.commit()
    return IssuedJoinInvitation(
        id=invitation.id,
        url=f"{settings.public_app_url.rstrip('/')}/client-invite#token={token}",
        expires_at=invitation.expires_at,
    )


async def cancel_join_invitation(session: AsyncSession, trainer_id: str, card_id: str) -> None:
    await owned_card(session, trainer_id, card_id, True)
    await session.execute(
        update(ClientJoinInvitation)
        .where(ClientJoinInvitation.card_id == card_id, ClientJoinInvitation.status == "PENDING")
        .values(status="CANCELLED")
    )
    await session.commit()


async def preview_join_invitation(session: AsyncSession, token: str) -> JoinPreview:
    invitation = validate_join(await repo.get_join(session, token_hash(token)))
    card = await repo.get_card(session, invitation.card_id)
    if card is None:
        raise conflict("INVITATION_UNAVAILABLE", "Invitation is unavailable")
    return JoinPreview(display_name=card.display_name, email_required=bool(card.contact_email))


async def accept_join_invitation(
    session: AsyncSession, account_id: str, token: str
) -> TrainerClientRelationship:
    account = await lock_account_for_client_join(session, account_id)
    if not account or account.role != "client" or not account.email_verified_at:
        raise BusinessRuleError(
            status_code=403, code="CLIENT_REQUIRED", message="Verified client required"
        )
    lookup = await repo.get_join(session, token_hash(token))
    if lookup is None:
        raise conflict("INVITATION_UNAVAILABLE", "Invitation is unavailable")
    card = await repo.get_card(session, lookup.card_id, True)
    invitation = await repo.get_join(session, token_hash(token), True)
    if card is None or invitation is None:
        raise conflict("INVITATION_UNAVAILABLE", "Invitation is unavailable")
    if invitation.status == "ACCEPTED":
        if card.client_account_id != account_id:
            raise conflict("INVITATION_USED", "Invitation already accepted")
        result = await repository.get_relationship(session, invitation.relationship_id or "")
        if result is None:
            raise conflict("INVITATION_UNAVAILABLE", "Relationship is unavailable")
        return result
    validate_join(invitation)
    if card.contact_email and card.contact_email != account.email.lower():
        raise conflict("INVITATION_EMAIL_MISMATCH", "Sign in with the invited email")
    if card.client_account_id and card.client_account_id != account_id:
        raise conflict("INVITATION_ACCOUNT_MISMATCH", "This card belongs to another account")
    duplicate = await session.scalar(
        select(TrainerClientCard).where(
            TrainerClientCard.trainer_id == card.trainer_id,
            TrainerClientCard.client_account_id == account_id,
            TrainerClientCard.id != card.id,
        )
    )
    if duplicate:
        raise conflict("CONTACT_EXISTS", "Account already linked to another client card")
    if await repository.find_active_relationship(session, card.trainer_id, account_id):
        raise conflict("ACTIVE_RELATIONSHIP_EXISTS", "Client already connected")
    legacy = await repository.find_pending_invitation(session, card.trainer_id, account_id)
    if legacy is None:
        legacy = TrainerClientInvitation(
            id=str(uuid4()), trainer_id=card.trainer_id, client_id=account_id, status="PENDING"
        )
        session.add(legacy)
        await session.flush()
    else:
        legacy = await repository.lock_invitation(session, legacy.id)
        if legacy is None:
            raise conflict("INVITATION_UNAVAILABLE", "Invitation is unavailable")
    legacy.status = "ACCEPTED"
    legacy.resolved_at = datetime.now(UTC)
    legacy.resolved_by_account_id = account_id
    relationship = TrainerClientRelationship(
        id=str(uuid4()),
        trainer_id=card.trainer_id,
        client_id=account_id,
        invitation_id=legacy.id,
        status="ACTIVE",
    )
    session.add(relationship)
    await session.flush()
    card.client_account_id = account_id
    invitation.status, invitation.relationship_id = "ACCEPTED", relationship.id
    await session.commit()
    await session.refresh(relationship)
    return relationship
