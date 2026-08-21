from __future__ import annotations

from datetime import datetime

from sqlalchemy import exists, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select

from toptrainers_api.modules.clients.models import (
    InvitationStatus,
    RelationshipStatus,
    TrainerClientInvitation,
    TrainerClientRelationship,
)
from toptrainers_api.modules.identity.models import Account


def account_for_update_query(account_id: str) -> Select[tuple[Account]]:
    return select(Account).where(Account.id == account_id).with_for_update()


def invitation_for_update_query(invitation_id: str) -> Select[tuple[TrainerClientInvitation]]:
    return (
        select(TrainerClientInvitation)
        .where(TrainerClientInvitation.id == invitation_id)
        .with_for_update()
    )


def relationship_for_update_query(
    relationship_id: str,
) -> Select[tuple[TrainerClientRelationship]]:
    return (
        select(TrainerClientRelationship)
        .where(TrainerClientRelationship.id == relationship_id)
        .with_for_update()
    )


def active_relationship_for_update_query(
    trainer_id: str,
    client_id: str,
) -> Select[tuple[TrainerClientRelationship]]:
    return (
        select(TrainerClientRelationship)
        .where(
            TrainerClientRelationship.trainer_id == trainer_id,
            TrainerClientRelationship.client_id == client_id,
            TrainerClientRelationship.status == RelationshipStatus.ACTIVE.value,
        )
        .with_for_update()
    )


def client_footprint_query(client_id: str) -> Select[tuple[bool]]:
    relationship_exists = exists(
        select(TrainerClientRelationship.id).where(
            TrainerClientRelationship.client_id == client_id
        )
    )
    return select(relationship_exists)


async def lock_account(session: AsyncSession, account_id: str) -> Account | None:
    account: Account | None = await session.scalar(account_for_update_query(account_id))
    return account


async def lock_invitation(
    session: AsyncSession,
    invitation_id: str,
) -> TrainerClientInvitation | None:
    invitation: TrainerClientInvitation | None = await session.scalar(
        invitation_for_update_query(invitation_id)
    )
    return invitation


async def lock_relationship(
    session: AsyncSession,
    relationship_id: str,
) -> TrainerClientRelationship | None:
    relationship: TrainerClientRelationship | None = await session.scalar(
        relationship_for_update_query(relationship_id)
    )
    return relationship


async def lock_active_relationship_for_pair(
    session: AsyncSession,
    trainer_id: str,
    client_id: str,
) -> TrainerClientRelationship | None:
    relationship: TrainerClientRelationship | None = await session.scalar(
        active_relationship_for_update_query(trainer_id, client_id)
    )
    return relationship


async def has_client_footprint(session: AsyncSession, client_id: str) -> bool:
    return bool(await session.scalar(client_footprint_query(client_id)))


async def cancel_pending_inbound_invitations(
    session: AsyncSession,
    client_id: str,
    *,
    resolved_at: datetime,
    resolution_reason: str,
) -> None:
    await session.execute(
        update(TrainerClientInvitation)
        .where(
            TrainerClientInvitation.client_id == client_id,
            TrainerClientInvitation.status == InvitationStatus.PENDING.value,
        )
        .values(
            status=InvitationStatus.CANCELLED.value,
            updated_at=resolved_at,
            resolved_at=resolved_at,
            resolved_by_account_id=None,
            resolution_reason=resolution_reason,
        )
    )


async def find_pending_invitation(
    session: AsyncSession,
    trainer_id: str,
    client_id: str,
) -> TrainerClientInvitation | None:
    invitation: TrainerClientInvitation | None = await session.scalar(
        select(TrainerClientInvitation).where(
            TrainerClientInvitation.trainer_id == trainer_id,
            TrainerClientInvitation.client_id == client_id,
            TrainerClientInvitation.status == InvitationStatus.PENDING.value,
        )
    )
    return invitation


async def find_active_relationship(
    session: AsyncSession,
    trainer_id: str,
    client_id: str,
) -> TrainerClientRelationship | None:
    relationship: TrainerClientRelationship | None = await session.scalar(
        select(TrainerClientRelationship).where(
            TrainerClientRelationship.trainer_id == trainer_id,
            TrainerClientRelationship.client_id == client_id,
            TrainerClientRelationship.status == RelationshipStatus.ACTIVE.value,
        )
    )
    return relationship


async def get_invitation_client_id(
    session: AsyncSession,
    invitation_id: str,
) -> str | None:
    client_id: str | None = await session.scalar(
        select(TrainerClientInvitation.client_id).where(
            TrainerClientInvitation.id == invitation_id
        )
    )
    return client_id


async def get_relationship_client_id(
    session: AsyncSession,
    relationship_id: str,
) -> str | None:
    client_id: str | None = await session.scalar(
        select(TrainerClientRelationship.client_id).where(
            TrainerClientRelationship.id == relationship_id
        )
    )
    return client_id


async def get_invitation(
    session: AsyncSession,
    invitation_id: str,
) -> TrainerClientInvitation | None:
    invitation: TrainerClientInvitation | None = await session.get(
        TrainerClientInvitation,
        invitation_id,
    )
    return invitation


async def get_relationship(
    session: AsyncSession,
    relationship_id: str,
) -> TrainerClientRelationship | None:
    relationship: TrainerClientRelationship | None = await session.get(
        TrainerClientRelationship,
        relationship_id,
    )
    return relationship


async def lock_relationship_by_invitation(
    session: AsyncSession,
    invitation_id: str,
) -> TrainerClientRelationship | None:
    relationship: TrainerClientRelationship | None = await session.scalar(
        select(TrainerClientRelationship)
        .where(TrainerClientRelationship.invitation_id == invitation_id)
        .with_for_update()
    )
    return relationship
