from __future__ import annotations

from sqlalchemy import exists, or_, select
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


def relationship_for_update_query(relationship_id: str) -> Select[tuple[TrainerClientRelationship]]:
    return (
        select(TrainerClientRelationship)
        .where(TrainerClientRelationship.id == relationship_id)
        .with_for_update()
    )


def client_footprint_query(client_id: str) -> Select[tuple[bool]]:
    invitation_exists = exists(
        select(TrainerClientInvitation.id).where(TrainerClientInvitation.client_id == client_id)
    )
    relationship_exists = exists(
        select(TrainerClientRelationship.id).where(TrainerClientRelationship.client_id == client_id)
    )
    return select(or_(invitation_exists, relationship_exists))


async def lock_account(session: AsyncSession, account_id: str) -> Account | None:
    return await session.scalar(account_for_update_query(account_id))


async def lock_invitation(
    session: AsyncSession, invitation_id: str
) -> TrainerClientInvitation | None:
    return await session.scalar(invitation_for_update_query(invitation_id))


async def lock_relationship(
    session: AsyncSession, relationship_id: str
) -> TrainerClientRelationship | None:
    return await session.scalar(relationship_for_update_query(relationship_id))


async def has_client_footprint(session: AsyncSession, client_id: str) -> bool:
    return bool(await session.scalar(client_footprint_query(client_id)))


async def find_pending_invitation(
    session: AsyncSession, trainer_id: str, client_id: str
) -> TrainerClientInvitation | None:
    return await session.scalar(
        select(TrainerClientInvitation).where(
            TrainerClientInvitation.trainer_id == trainer_id,
            TrainerClientInvitation.client_id == client_id,
            TrainerClientInvitation.status == InvitationStatus.PENDING.value,
        )
    )


async def find_active_relationship(
    session: AsyncSession, trainer_id: str, client_id: str
) -> TrainerClientRelationship | None:
    return await session.scalar(
        select(TrainerClientRelationship).where(
            TrainerClientRelationship.trainer_id == trainer_id,
            TrainerClientRelationship.client_id == client_id,
            TrainerClientRelationship.status == RelationshipStatus.ACTIVE.value,
        )
    )


async def get_invitation_client_id(
    session: AsyncSession, invitation_id: str
) -> str | None:
    return await session.scalar(
        select(TrainerClientInvitation.client_id).where(
            TrainerClientInvitation.id == invitation_id
        )
    )


async def get_relationship_client_id(
    session: AsyncSession, relationship_id: str
) -> str | None:
    return await session.scalar(
        select(TrainerClientRelationship.client_id).where(
            TrainerClientRelationship.id == relationship_id
        )
    )


async def get_invitation(
    session: AsyncSession, invitation_id: str
) -> TrainerClientInvitation | None:
    return await session.get(TrainerClientInvitation, invitation_id)


async def get_relationship(
    session: AsyncSession, relationship_id: str
) -> TrainerClientRelationship | None:
    return await session.get(TrainerClientRelationship, relationship_id)


async def lock_relationship_by_invitation(
    session: AsyncSession, invitation_id: str
) -> TrainerClientRelationship | None:
    return await session.scalar(
        select(TrainerClientRelationship)
        .where(TrainerClientRelationship.invitation_id == invitation_id)
        .with_for_update()
    )
