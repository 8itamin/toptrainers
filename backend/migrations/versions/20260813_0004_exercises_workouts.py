"""Add trainer exercise libraries and workout templates.

Revision ID: 20260813_0004
Revises: 20260813_0003
"""

from alembic import op
import sqlalchemy as sa


revision = "20260813_0004"
down_revision = "20260813_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "exercises",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("trainer_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("direction", sa.String(length=32), nullable=False),
        sa.Column("muscle_group", sa.String(length=64), nullable=False),
        sa.Column("instruction", sa.Text(), nullable=False),
        sa.Column("reference_url", sa.String(length=2048), nullable=True),
        sa.Column("video_platform", sa.String(length=32), nullable=True),
        sa.Column("video_url", sa.String(length=2048), nullable=True),
        sa.Column("video_file_url", sa.String(length=2048), nullable=True),
        sa.Column("thumbnail_url", sa.String(length=2048), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_exercises_trainer_id", "exercises", ["trainer_id"])
    op.create_index("ix_exercises_direction", "exercises", ["direction"])
    op.create_index("ix_exercises_muscle_group", "exercises", ["muscle_group"])
    op.create_table(
        "workouts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("trainer_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workouts_trainer_id", "workouts", ["trainer_id"])
    op.create_table(
        "workout_blocks",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("workout_id", sa.String(length=36), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["workout_id"], ["workouts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workout_blocks_workout_id", "workout_blocks", ["workout_id"])
    op.create_table(
        "workout_exercises",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("workout_block_id", sa.String(length=36), nullable=False),
        sa.Column("exercise_id", sa.String(length=36), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("weight_kg", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("sets", sa.Integer(), nullable=False),
        sa.Column("reps", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["workout_block_id"], ["workout_blocks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["exercise_id"], ["exercises.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workout_exercises_workout_block_id", "workout_exercises", ["workout_block_id"])
    op.create_index("ix_workout_exercises_exercise_id", "workout_exercises", ["exercise_id"])


def downgrade() -> None:
    op.drop_index("ix_workout_exercises_exercise_id", table_name="workout_exercises")
    op.drop_index("ix_workout_exercises_workout_block_id", table_name="workout_exercises")
    op.drop_table("workout_exercises")
    op.drop_index("ix_workout_blocks_workout_id", table_name="workout_blocks")
    op.drop_table("workout_blocks")
    op.drop_index("ix_workouts_trainer_id", table_name="workouts")
    op.drop_table("workouts")
    op.drop_index("ix_exercises_muscle_group", table_name="exercises")
    op.drop_index("ix_exercises_direction", table_name="exercises")
    op.drop_index("ix_exercises_trainer_id", table_name="exercises")
    op.drop_table("exercises")
