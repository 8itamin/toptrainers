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
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from toptrainers_api.core.db import Base


class WorkoutAssignmentStatus(StrEnum):
    PLANNED = "PLANNED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class WorkoutAssignment(Base):
    __tablename__ = "workout_assignments"
    __table_args__ = (
        CheckConstraint(
            "status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')",
            name="ck_workout_assignments_status",
        ),
        CheckConstraint(
            "snapshot_schema_version = 1",
            name="ck_workout_assignments_snapshot_schema_version",
        ),
        UniqueConstraint(
            "relationship_id",
            "request_id",
            name="uq_workout_assignments_relationship_request_id",
        ),
        Index(
            "ix_workout_assignments_relationship_status",
            "relationship_id",
            "status",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    relationship_id: Mapped[str] = mapped_column(
        ForeignKey("trainer_client_relationships.id"), index=True
    )
    source_workout_id: Mapped[str] = mapped_column(ForeignKey("workouts.id"), index=True)
    request_id: Mapped[str] = mapped_column(String(128), nullable=False)
    workout_snapshot: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    snapshot_schema_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
