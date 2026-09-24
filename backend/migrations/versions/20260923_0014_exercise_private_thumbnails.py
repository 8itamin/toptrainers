"""Persist private exercise thumbnail references.

Revision ID: 20260923_0014
Revises: 20260923_0013
"""

import sqlalchemy as sa
from alembic import op

revision = "20260923_0014"
down_revision = "20260923_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "exercises",
        sa.Column("thumbnail_media_id", sa.String(length=36), nullable=True),
    )
    op.create_foreign_key(
        "fk_exercises_thumbnail_media_id_media_objects",
        "exercises",
        "media_objects",
        ["thumbnail_media_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_exercises_thumbnail_media_id", "exercises", ["thumbnail_media_id"])


def downgrade() -> None:
    op.drop_index("ix_exercises_thumbnail_media_id", table_name="exercises")
    op.drop_constraint(
        "fk_exercises_thumbnail_media_id_media_objects",
        "exercises",
        type_="foreignkey",
    )
    op.drop_column("exercises", "thumbnail_media_id")
