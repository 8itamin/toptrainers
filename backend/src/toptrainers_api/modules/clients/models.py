from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from toptrainers_api.core.db import Base


class InvitationStatus(StrEnum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class RelationshipStatus(StrEnum):
    ACTIVE = "ACTIVE"
    TERMINATED = "TERMINATED"


class TrainerClientInvitation(Base):
    __tablename__ = "trainer_client_invitations"
    __table_args__ = (
        CheckConstraint(
            "trainer_id <> client_id",
            name="ck_trainer_client_invitations_distinct_accounts",
        ),
        CheckConstraint(
            "status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED')",
            name="ck_trainer_client_invitations_status",
        ),
        Index(
            "uq_trainer_client_invitations_pending_pair",
            "trainer_id",
            "client_id",
            unique=True,
            postgresql_where=text("status = 'PENDING'"),
        ),
        Index(
            "ix_trainer_client_invitations_pair",
            "trainer_id",
            "client_id",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    trainer_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), index=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), index=True)
    status: Mapped[str] = mapped_column(String(16), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class TrainerClientRelationship(Base):
    __tablename__ = "trainer_client_relationships"
    __table_args__ = (
        CheckConstraint(
            "trainer_id <> client_id",
            name="ck_trainer_client_relationships_distinct_accounts",
        ),
        CheckConstraint(
            "status IN ('ACTIVE', 'TERMINATED')",
            name="ck_trainer_client_relationships_status",
        ),
        UniqueConstraint(
            "invitation_id",
            name="uq_trainer_client_relationships_invitation_id",
        ),
        Index(
            "uq_trainer_client_relationships_active_pair",
            "trainer_id",
            "client_id",
            unique=True,
            postgresql_where=text("status = 'ACTIVE'"),
        ),
        Index(
            "ix_trainer_client_relationships_pair",
            "trainer_id",
            "client_id",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    trainer_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), index=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), index=True)
    invitation_id: Mapped[str] = mapped_column(
        ForeignKey("trainer_client_invitations.id")
    )
    status: Mapped[str] = mapped_column(String(16), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    terminated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
