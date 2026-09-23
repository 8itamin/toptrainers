"""Persist editable exercise details and private video references.

Revision ID: 20260923_0013
Revises: 20260922_0012
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260923_0013"
down_revision = "20260922_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "exercises",
        sa.Column(
            "muscle_groups",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )
    op.execute("UPDATE exercises SET muscle_groups = jsonb_build_array(muscle_group)")
    op.add_column(
        "exercises",
        sa.Column("video_media_id", sa.String(length=36), nullable=True),
    )
    op.create_foreign_key(
        "fk_exercises_video_media_id_media_objects",
        "exercises",
        "media_objects",
        ["video_media_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_exercises_video_media_id", "exercises", ["video_media_id"])


def downgrade() -> None:
    op.drop_index("ix_exercises_video_media_id", table_name="exercises")
    op.drop_constraint("fk_exercises_video_media_id_media_objects", "exercises", type_="foreignkey")
    op.drop_column("exercises", "video_media_id")
    op.drop_column("exercises", "muscle_groups")
