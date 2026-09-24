"""Persist private exercise thumbnail processing jobs.

Revision ID: 20260924_0016
Revises: 20260924_0015
"""

import sqlalchemy as sa
from alembic import op

revision = "20260924_0016"
down_revision = "20260924_0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_media_objects_status", "media_objects", type_="check")
    op.create_check_constraint(
        "ck_media_objects_status",
        "media_objects",
        "status IN ('PENDING', 'PROCESSING', 'READY', 'FAILED')",
    )
    op.create_table(
        "exercise_thumbnail_jobs",
        sa.Column("source_media_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="PENDING"),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error_code", sa.String(length=64), nullable=True),
        sa.CheckConstraint(
            "status IN ('PENDING', 'PROCESSING', 'READY', 'FAILED')",
            name="ck_exercise_thumbnail_jobs_status",
        ),
        sa.CheckConstraint(
            "attempt_count >= 0",
            name="ck_exercise_thumbnail_jobs_attempt_count",
        ),
        sa.ForeignKeyConstraint(
            ["source_media_id"],
            ["media_objects.id"],
            name="fk_exercise_thumbnail_jobs_source_media_id_media_objects",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("source_media_id"),
    )
    op.create_index(
        "ix_exercise_thumbnail_jobs_status_lease_expires_at",
        "exercise_thumbnail_jobs",
        ["status", "lease_expires_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_exercise_thumbnail_jobs_status_lease_expires_at",
        table_name="exercise_thumbnail_jobs",
    )
    op.drop_table("exercise_thumbnail_jobs")
    op.drop_constraint("ck_media_objects_status", "media_objects", type_="check")
    op.create_check_constraint(
        "ck_media_objects_status",
        "media_objects",
        "status IN ('PENDING', 'READY')",
    )
