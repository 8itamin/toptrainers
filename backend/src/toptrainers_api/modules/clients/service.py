from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.errors import BusinessRuleError
from toptrainers_api.modules.clients import repository
from toptrainers_api.modules.clients.models import (
    InvitationStatus,
    RelationshipStatus,
    TrainerClientInvitation,
    TrainerClientRelationship,
)

_PENDING_INVITATION_CONSTRAINT = "uq_trainer_client_invitations_pending_pair"
_ACTIVE_RELATIONSHIP_CONSTRAINT = "uq_trainer_client_relationships_active_pair"


def _conflict(code: str, message: str) -> BusinessRuleError:
    return BusinessRuleError(status_code=409, code=code, message=message)


def _not_found(code: str, message: str) -> BusinessRuleError:
    return BusinessRuleError(status_code=404, code=code, message=message)


def _forbidden(code: str, message: str) -> BusinessRuleError:
    return BusinessRuleError(status_code=403, code=code, message=message)


def _integrity_constraint_name(error: IntegrityError) -> str | None:
    current: object | None = error.orig
    visited: set[int] = set()
    while current is not None and id(current) not in visited:
        visited.add(id(current))
        constraint_name = getattr(current, "constraint_name", None)
        if isinstance(constraint_name, str):
            return constraint_name

        cause = getattr(current, "__cause__", None)
        if isinstance(cause, BaseException):
            current = cause
            continue
        context = getattr(current, "__context__", None)
        current = context if isinstance(context, BaseException) else None
    return None


async def has_client_p0_footprint(session: AsyncSession, client_id: str) -> bool:
    return await repository.has_client_footprint(session, client_id)


async def create_invitation(
    session: AsyncSession, trainer_id: str, client_id: str
) -> TrainerClientInvitation:
    client = await repository.lock_account(session, client_id)
    if client is None:
        raise _not_found("CLIENT_NOT_FOUND", "Client account was not found")
    if client.role != "client":
        raise _conflict("TARGET_NOT_CLIENT", "Invitation target is not a client account")

    if await repository.find_active_relationship(session, trainer_id, client_id) is not None:
        raise _conflict(
            "ACTIVE_RELATIONSHIP_EXISTS",
            "Trainer and client already have an active relationship",
        )
    if await repository.find_pending_invitation(session, trainer_id, client_id) is not None:
        raise _conflict(
            "INVITATION_ALREADY_PENDING",
            "A pending invitation already exists for this trainer and client",
        )

    invitation = TrainerClientInvitation(
        id=str(uuid4()),
        trainer_id=trainer_id,
        client_id=client_id,
        status=InvitationStatus.PENDING.value,
    )
    session.add(invitation)
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        if _integrity_constraint_name(error) != _PENDING_INVITATION_CONSTRAINT:
            raise
        raise _conflict(
            "INVITATION_ALREADY_PENDING",
            "A pending invitation already exists for this trainer and client",
        ) from error
    await session.refresh(invitation)
    return invitation


async def _lock_invitation_with_client(
    session: AsyncSession, invitation_id: str
) -> TrainerClientInvitation:
    client_id = await repository.get_invitation_client_id(session, invitation_id)
    if client_id is None:
        raise _not_found("INVITATION_NOT_FOUND", "Invitation was not found")

    client = await repository.lock_account(session, client_id)
    if client is None:
        raise _not_found("CLIENT_NOT_FOUND", "Client account was not found")

    invitation = await repository.lock_invitation(session, invitation_id)
    if invitation is None:
        raise _not_found("INVITATION_NOT_FOUND", "Invitation was not found")
    return invitation


async def accept_invitation(
    session: AsyncSession, actor_id: str, invitation_id: str
) -> TrainerClientRelationship:
    invitation = await _lock_invitation_with_client(session, invitation_id)
    if invitation.client_id != actor_id:
        raise _forbidden("INVITATION_CLIENT_REQUIRED", "Only the invited client can accept")

    if invitation.status == InvitationStatus.ACCEPTED.value:
        relationship = await repository.lock_relationship_by_invitation(session, invitation.id)
        if relationship is None:
            raise _conflict(
                "INVITATION_RELATIONSHIP_INCONSISTENT",
                "Accepted invitation has no relationship",
            )
        return relationship
    if invitation.status != InvitationStatus.PENDING.value:
        raise _conflict("INVITATION_STATE_CONFLICT", "Invitation is no longer pending")

    if (
        await repository.find_active_relationship(
            session, invitation.trainer_id, invitation.client_id
        )
        is not None
    ):
        raise _conflict(
            "ACTIVE_RELATIONSHIP_EXISTS",
            "Trainer and client already have an active relationship",
        )

    relationship = TrainerClientRelationship(
        id=str(uuid4()),
        trainer_id=invitation.trainer_id,
        client_id=invitation.client_id,
        invitation_id=invitation.id,
        status=RelationshipStatus.ACTIVE.value,
    )
    invitation.status = InvitationStatus.ACCEPTED.value
    session.add(relationship)
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        if _integrity_constraint_name(error) != _ACTIVE_RELATIONSHIP_CONSTRAINT:
            raise
        raise _conflict(
            "ACTIVE_RELATIONSHIP_EXISTS",
            "Trainer and client already have an active relationship",
        ) from error
    await session.refresh(relationship)
    return relationship


async def reject_invitation(
    session: AsyncSession, actor_id: str, invitation_id: str
) -> TrainerClientInvitation:
    invitation = await _lock_invitation_with_client(session, invitation_id)
    if invitation.client_id != actor_id:
        raise _forbidden("INVITATION_CLIENT_REQUIRED", "Only the invited client can reject")
    if invitation.status == InvitationStatus.REJECTED.value:
        return invitation
    if invitation.status != InvitationStatus.PENDING.value:
        raise _conflict("INVITATION_STATE_CONFLICT", "Invitation is no longer pending")

    invitation.status = InvitationStatus.REJECTED.value
    await session.commit()
    await session.refresh(invitation)
    return invitation


async def cancel_invitation(
    session: AsyncSession, actor_id: str, invitation_id: str
) -> TrainerClientInvitation:
    invitation = await _lock_invitation_with_client(session, invitation_id)
    if invitation.trainer_id != actor_id:
        raise _forbidden("INVITATION_TRAINER_REQUIRED", "Only the inviting trainer can cancel")
    if invitation.status == InvitationStatus.CANCELLED.value:
        return invitation
    if invitation.status != InvitationStatus.PENDING.value:
        raise _conflict("INVITATION_STATE_CONFLICT", "Invitation is no longer pending")

    invitation.status = InvitationStatus.CANCELLED.value
    await session.commit()
    await session.refresh(invitation)
    return invitation


async def terminate_relationship(
    session: AsyncSession, actor_id: str, relationship_id: str
) -> TrainerClientRelationship:
    client_id = await repository.get_relationship_client_id(session, relationship_id)
    if client_id is None:
        raise _not_found("RELATIONSHIP_NOT_FOUND", "Relationship was not found")

    client = await repository.lock_account(session, client_id)
    if client is None:
        raise _not_found("CLIENT_NOT_FOUND", "Client account was not found")

    relationship = await repository.lock_relationship(session, relationship_id)
    if relationship is None:
        raise _not_found("RELATIONSHIP_NOT_FOUND", "Relationship was not found")
    if actor_id not in {relationship.trainer_id, relationship.client_id}:
        raise _forbidden(
            "RELATIONSHIP_PARTY_REQUIRED",
            "Only the trainer or client in this relationship can terminate it",
        )
    if relationship.status == RelationshipStatus.TERMINATED.value:
        return relationship

    relationship.status = RelationshipStatus.TERMINATED.value
    relationship.terminated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(relationship)
    return relationship
