"""Add singleton workout executions.

Revision ID: 20260824_0007
Revises: 20260822_0006
"""

import sqlalchemy as sa
from alembic import op

revision = "20260824_0007"
down_revision = "20260822_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workout_executions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("assignment_id", sa.String(length=36), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["assignment_id"], ["workout_assignments.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "assignment_id",
            name="uq_workout_executions_assignment_id",
        ),
    )


def downgrade() -> None:
    op.drop_table("workout_executions")
