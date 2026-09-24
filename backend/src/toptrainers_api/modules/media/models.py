from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from toptrainers_api.core.db import Base


class MediaObject(Base):
    __tablename__ = "media_objects"
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'PROCESSING', 'READY', 'FAILED')",
            name="ck_media_objects_status",
        ),
        CheckConstraint("content_length > 0", name="ck_media_objects_content_length_positive"),
        UniqueConstraint("object_key", name="uq_media_objects_object_key"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    object_key: Mapped[str] = mapped_column(String(256), nullable=False)
    content_type: Mapped[str] = mapped_column(String(32), nullable=False)
    content_length: Mapped[int] = mapped_column(Integer, nullable=False)
    purpose: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ExerciseVideoStream(Base):
    __tablename__ = "exercise_video_streams"
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'PROCESSING', 'READY', 'FAILED')",
            name="ck_exercise_video_streams_status",
        ),
        CheckConstraint("attempt_count >= 0", name="ck_exercise_video_streams_attempt_count"),
        Index(
            "ix_exercise_video_streams_status_lease_expires_at",
            "status",
            "lease_expires_at",
        ),
    )

    source_media_id: Mapped[str] = mapped_column(
        ForeignKey("media_objects.id", ondelete="CASCADE"),
        primary_key=True,
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="PENDING")
    manifest_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    segment_prefix: Mapped[str | None] = mapped_column(String(512), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    lease_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    last_error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)


class ExerciseThumbnailJob(Base):
    __tablename__ = "exercise_thumbnail_jobs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'PROCESSING', 'READY', 'FAILED')",
            name="ck_exercise_thumbnail_jobs_status",
        ),
        CheckConstraint(
            "attempt_count >= 0",
            name="ck_exercise_thumbnail_jobs_attempt_count",
        ),
        Index(
            "ix_exercise_thumbnail_jobs_status_lease_expires_at",
            "status",
            "lease_expires_at",
        ),
    )

    source_media_id: Mapped[str] = mapped_column(
        ForeignKey("media_objects.id", ondelete="CASCADE"),
        primary_key=True,
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="PENDING")
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    lease_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    last_error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
