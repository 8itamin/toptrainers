"""Add private S3 media metadata.

Revision ID: 20260922_0012
Revises: 20260922_0011
"""

import sqlalchemy as sa
from alembic import op

revision = "20260922_0012"
down_revision = "20260922_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "media_objects",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("owner_id", sa.String(length=36), nullable=False),
        sa.Column("object_key", sa.String(length=256), nullable=False),
        sa.Column("content_type", sa.String(length=32), nullable=False),
        sa.Column("content_length", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('PENDING', 'READY')", name="ck_media_objects_status"),
        sa.CheckConstraint("content_length > 0", name="ck_media_objects_content_length_positive"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("object_key", name="uq_media_objects_object_key"),
    )
    op.create_index("ix_media_objects_owner_id", "media_objects", ["owner_id"])


def downgrade() -> None:
    op.drop_index("ix_media_objects_owner_id", table_name="media_objects")
    op.drop_table("media_objects")
