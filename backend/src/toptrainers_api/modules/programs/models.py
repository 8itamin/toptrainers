from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from toptrainers_api.core.db import Base


class Program(Base):
    __tablename__ = "programs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    trainer_id: Mapped[str] = mapped_column(String(36), index=True)
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    duration_weeks: Mapped[int] = mapped_column("weeks", Integer, default=1)
    slots: Mapped[list[ProgramSlot]] = relationship(
        back_populates="program",
        cascade="all, delete-orphan",
        order_by="ProgramSlot.week_number, ProgramSlot.day_number",
    )


class ProgramSlot(Base):
    __tablename__ = "program_slots"
    __table_args__ = (
        CheckConstraint("week_number >= 1", name="ck_program_slots_week_number_positive"),
        CheckConstraint("day_number >= 1", name="ck_program_slots_day_number_positive"),
        CheckConstraint("day_number <= 7", name="ck_program_slots_day_number_max"),
        UniqueConstraint(
            "program_id",
            "week_number",
            "day_number",
            name="uq_program_slots_program_week_day",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    program_id: Mapped[str] = mapped_column(
        ForeignKey("programs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    week_number: Mapped[int] = mapped_column(Integer, nullable=False)
    day_number: Mapped[int] = mapped_column(Integer, nullable=False)
    workout_id: Mapped[str] = mapped_column(
        ForeignKey("workouts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    program: Mapped[Program] = relationship(back_populates="slots")


class ProgramAssignmentStatus(StrEnum):
    ISSUED = "ISSUED"
    CANCELLED = "CANCELLED"


class ProgramAssignment(Base):
    __tablename__ = "program_assignments"
    __table_args__ = (
        CheckConstraint(
            "status IN ('ISSUED', 'CANCELLED')",
            name="ck_program_assignments_status",
        ),
        CheckConstraint(
            "snapshot_schema_version = 1",
            name="ck_program_assignments_snapshot_schema_version",
        ),
        UniqueConstraint(
            "relationship_id",
            "request_id",
            name="uq_program_assignments_relationship_request_id",
        ),
        Index(
            "ix_program_assignments_relationship_status",
            "relationship_id",
            "status",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    program_id: Mapped[str] = mapped_column(ForeignKey("programs.id"), nullable=False, index=True)
    relationship_id: Mapped[str] = mapped_column(
        ForeignKey("trainer_client_relationships.id"),
        nullable=False,
        index=True,
    )
    request_id: Mapped[str] = mapped_column(String(128), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    program_snapshot: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    snapshot_schema_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
