from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from toptrainers_api.core.db import Base


class TaskTemplate(Base):
    __tablename__ = "task_templates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    trainer_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    instruction: Mapped[str] = mapped_column(Text, nullable=False, default="")
    result_schema: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)


class TaskAssignment(Base):
    __tablename__ = "task_assignments"
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'COMPLETED', 'CANCELLED')",
            name="ck_task_assignments_status",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    relationship_id: Mapped[str] = mapped_column(
        ForeignKey("trainer_client_relationships.id"),
        nullable=False,
        index=True,
    )
    source_task_template_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    program_assignment_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    program_slot_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    task_snapshot: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)


class TaskResultVersion(Base):
    __tablename__ = "task_result_versions"
    __table_args__ = (
        UniqueConstraint(
            "assignment_id",
            "request_id",
            name="uq_task_result_versions_assignment_request_id",
        ),
    )

    assignment_id: Mapped[str] = mapped_column(
        ForeignKey("task_assignments.id"),
        primary_key=True,
    )
    version: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[str] = mapped_column(String(128), nullable=False)
    result_payload: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
