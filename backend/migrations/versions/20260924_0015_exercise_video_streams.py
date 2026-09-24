"""Persist HLS stream jobs for private exercise videos.

Revision ID: 20260924_0015
Revises: 20260923_0014
"""

import sqlalchemy as sa
from alembic import op

revision = "20260924_0015"
down_revision = "20260923_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "exercise_video_streams",
        sa.Column("source_media_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="PENDING"),
        sa.Column("manifest_key", sa.String(length=512), nullable=True),
        sa.Column("segment_prefix", sa.String(length=512), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error_code", sa.String(length=64), nullable=True),
        sa.CheckConstraint(
            "status IN ('PENDING', 'PROCESSING', 'READY', 'FAILED')",
            name="ck_exercise_video_streams_status",
        ),
        sa.CheckConstraint(
            "attempt_count >= 0",
            name="ck_exercise_video_streams_attempt_count",
        ),
        sa.ForeignKeyConstraint(
            ["source_media_id"],
            ["media_objects.id"],
            name="fk_exercise_video_streams_source_media_id_media_objects",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("source_media_id"),
    )
    op.create_index(
        "ix_exercise_video_streams_status_lease_expires_at",
        "exercise_video_streams",
        ["status", "lease_expires_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_exercise_video_streams_status_lease_expires_at",
        table_name="exercise_video_streams",
    )
    op.drop_table("exercise_video_streams")
