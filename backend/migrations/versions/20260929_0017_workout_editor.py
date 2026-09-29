"""Add named workout blocks and per-exercise rest.

Revision ID: 20260929_0017
Revises: 20260924_0016
"""

import sqlalchemy as sa
from alembic import op

revision = "20260929_0017"
down_revision = "20260924_0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "workout_blocks",
        sa.Column("title", sa.String(length=160), server_default="", nullable=False),
    )
    op.add_column(
        "workout_exercises",
        sa.Column("rest_seconds", sa.Integer(), server_default="60", nullable=False),
    )
    op.create_check_constraint(
        "ck_workout_exercises_rest_seconds", "workout_exercises", "rest_seconds BETWEEN 0 AND 3600"
    )


def downgrade() -> None:
    op.drop_constraint("ck_workout_exercises_rest_seconds", "workout_exercises", type_="check")
    op.drop_column("workout_exercises", "rest_seconds")
    op.drop_column("workout_blocks", "title")
