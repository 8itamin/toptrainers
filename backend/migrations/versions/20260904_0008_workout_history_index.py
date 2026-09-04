"""Add partial index for completed workout history reads.

Revision ID: 20260904_0008
Revises: 20260824_0007
"""

import sqlalchemy as sa
from alembic import op

revision = "20260904_0008"
down_revision = "20260824_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_workout_executions_history_completed",
        "workout_executions",
        [sa.text("completed_at DESC"), sa.text("assignment_id DESC")],
        unique=False,
        postgresql_where=sa.text("completed_at IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_workout_executions_history_completed",
        table_name="workout_executions",
    )
