"""Add workout execution set results.

Revision ID: 20260904_0009
Revises: 20260904_0008
"""

import sqlalchemy as sa
from alembic import op

revision = "20260904_0009"
down_revision = "20260904_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workout_execution_set_results",
        sa.Column(
            "execution_id",
            sa.String(length=36),
            sa.ForeignKey("workout_executions.id"),
            nullable=False,
        ),
        sa.Column("block_position", sa.Integer(), nullable=False),
        sa.Column("exercise_position", sa.Integer(), nullable=False),
        sa.Column("set_index", sa.Integer(), nullable=False),
        sa.Column("actual_reps", sa.Integer(), nullable=True),
        sa.Column("actual_weight_kg", sa.Numeric(6, 2), nullable=True),
        sa.CheckConstraint(
            "block_position >= 0",
            name="ck_execution_set_results_block_position",
        ),
        sa.CheckConstraint(
            "exercise_position >= 0",
            name="ck_execution_set_results_exercise_position",
        ),
        sa.CheckConstraint(
            "set_index >= 0",
            name="ck_execution_set_results_set_index",
        ),
        sa.CheckConstraint(
            "actual_reps IS NULL OR (actual_reps >= 0 AND actual_reps <= 1000)",
            name="ck_execution_set_results_actual_reps",
        ),
        sa.CheckConstraint(
            "actual_weight_kg IS NULL OR (actual_weight_kg >= 0 AND actual_weight_kg <= 1000)",
            name="ck_execution_set_results_actual_weight_kg",
        ),
        sa.CheckConstraint(
            "actual_reps IS NOT NULL OR actual_weight_kg IS NOT NULL",
            name="ck_execution_set_results_any_actual",
        ),
        sa.PrimaryKeyConstraint(
            "execution_id",
            "block_position",
            "exercise_position",
            "set_index",
            name="pk_workout_execution_set_results",
        ),
    )


def downgrade() -> None:
    op.drop_table("workout_execution_set_results")
