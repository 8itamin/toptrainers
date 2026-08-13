"""Expand account password hash storage.

Revision ID: 20260813_0003
Revises: 20260813_0002
"""

from alembic import op
import sqlalchemy as sa


revision = "20260813_0003"
down_revision = "20260813_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "accounts",
        "password_hash",
        existing_type=sa.String(length=128),
        type_=sa.String(length=255),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "accounts",
        "password_hash",
        existing_type=sa.String(length=255),
        type_=sa.String(length=128),
        existing_nullable=False,
    )
