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


class TrainerClientCard(Base):
    __tablename__ = "trainer_client_cards"
    __table_args__ = (
        UniqueConstraint("trainer_id", "client_account_id", name="uq_client_card_account"),
        UniqueConstraint("trainer_id", "contact_email", name="uq_client_card_email"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    trainer_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), index=True)
    display_name: Mapped[str] = mapped_column(String(120))
    contact_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    client_account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ClientJoinInvitation(Base):
    __tablename__ = "client_join_invitations"
    __table_args__ = (
        CheckConstraint("status IN ('PENDING', 'ACCEPTED', 'CANCELLED')", name="ck_join_status"),
        Index(
            "uq_join_pending_card",
            "card_id",
            unique=True,
            postgresql_where=text("status = 'PENDING'"),
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    card_id: Mapped[str] = mapped_column(ForeignKey("trainer_client_cards.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    status: Mapped[str] = mapped_column(String(16))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    relationship_id: Mapped[str | None] = mapped_column(
        ForeignKey("trainer_client_relationships.id"), nullable=True
    )


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
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by_account_id: Mapped[str | None] = mapped_column(
        ForeignKey("accounts.id"), nullable=True
    )
    resolution_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)


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
    invitation_id: Mapped[str] = mapped_column(ForeignKey("trainer_client_invitations.id"))
    status: Mapped[str] = mapped_column(String(16), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    terminated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
