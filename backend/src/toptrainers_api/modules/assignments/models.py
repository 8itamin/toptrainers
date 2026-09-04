from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    text,
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


class WorkoutExecution(Base):
    __tablename__ = "workout_executions"
    __table_args__ = (
        UniqueConstraint(
            "assignment_id",
            name="uq_workout_executions_assignment_id",
        ),
        Index(
            "ix_workout_executions_history_completed",
            text("completed_at DESC"),
            text("assignment_id DESC"),
            postgresql_where=text("completed_at IS NOT NULL"),
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    assignment_id: Mapped[str] = mapped_column(
        ForeignKey("workout_assignments.id"), nullable=False
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class WorkoutExecutionSetResult(Base):
    __tablename__ = "workout_execution_set_results"
    __table_args__ = (
        CheckConstraint("block_position >= 0", name="ck_execution_set_results_block_position"),
        CheckConstraint(
            "exercise_position >= 0",
            name="ck_execution_set_results_exercise_position",
        ),
        CheckConstraint("set_index >= 0", name="ck_execution_set_results_set_index"),
        CheckConstraint(
            "actual_reps IS NULL OR (actual_reps >= 0 AND actual_reps <= 1000)",
            name="ck_execution_set_results_actual_reps",
        ),
        CheckConstraint(
            "actual_weight_kg IS NULL OR (actual_weight_kg >= 0 AND actual_weight_kg <= 1000)",
            name="ck_execution_set_results_actual_weight_kg",
        ),
        CheckConstraint(
            "actual_reps IS NOT NULL OR actual_weight_kg IS NOT NULL",
            name="ck_execution_set_results_any_actual",
        ),
    )

    execution_id: Mapped[str] = mapped_column(
        ForeignKey("workout_executions.id"),
        primary_key=True,
    )
    block_position: Mapped[int] = mapped_column(Integer, primary_key=True)
    exercise_position: Mapped[int] = mapped_column(Integer, primary_key=True)
    set_index: Mapped[int] = mapped_column(Integer, primary_key=True)
    actual_reps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actual_weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
