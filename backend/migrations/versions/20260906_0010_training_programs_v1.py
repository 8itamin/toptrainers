"""Add Training Programs v1 schedule and issuance state.

Revision ID: 20260906_0010
Revises: 20260904_0009

Downgrade deletes ProgramAssignment data and child provenance. It is destructive
after program issuance and is not a production rollback strategy.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260906_0010"
down_revision = "20260904_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "program_slots",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("program_id", sa.String(length=36), nullable=False),
        sa.Column("week_number", sa.Integer(), nullable=False),
        sa.Column("day_number", sa.Integer(), nullable=False),
        sa.Column("workout_id", sa.String(length=36), nullable=False),
        sa.CheckConstraint("week_number >= 1", name="ck_program_slots_week_number_positive"),
        sa.CheckConstraint("day_number >= 1", name="ck_program_slots_day_number_positive"),
        sa.CheckConstraint("day_number <= 7", name="ck_program_slots_day_number_max"),
        sa.ForeignKeyConstraint(["program_id"], ["programs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workout_id"], ["workouts.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "program_id",
            "week_number",
            "day_number",
            name="uq_program_slots_program_week_day",
        ),
    )
    op.create_index("ix_program_slots_program_id", "program_slots", ["program_id"], unique=False)
    op.create_index("ix_program_slots_workout_id", "program_slots", ["workout_id"], unique=False)

    op.create_table(
        "program_assignments",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("program_id", sa.String(length=36), nullable=False),
        sa.Column("relationship_id", sa.String(length=36), nullable=False),
        sa.Column("request_id", sa.String(length=128), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("program_snapshot", postgresql.JSONB(), nullable=False),
        sa.Column("snapshot_schema_version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('ISSUED', 'CANCELLED')",
            name="ck_program_assignments_status",
        ),
        sa.CheckConstraint(
            "snapshot_schema_version = 1",
            name="ck_program_assignments_snapshot_schema_version",
        ),
        sa.ForeignKeyConstraint(["program_id"], ["programs.id"]),
        sa.ForeignKeyConstraint(["relationship_id"], ["trainer_client_relationships.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "relationship_id",
            "request_id",
            name="uq_program_assignments_relationship_request_id",
        ),
    )
    op.create_index(
        "ix_program_assignments_program_id",
        "program_assignments",
        ["program_id"],
        unique=False,
    )
    op.create_index(
        "ix_program_assignments_relationship_id",
        "program_assignments",
        ["relationship_id"],
        unique=False,
    )
    op.create_index(
        "ix_program_assignments_relationship_status",
        "program_assignments",
        ["relationship_id", "status"],
        unique=False,
    )

    op.add_column(
        "workout_assignments",
        sa.Column("program_assignment_id", sa.String(length=36), nullable=True),
    )
    op.add_column(
        "workout_assignments",
        sa.Column("program_slot_id", sa.String(length=36), nullable=True),
    )
    op.create_foreign_key(
        "fk_workout_assignments_program_assignment_id",
        "workout_assignments",
        "program_assignments",
        ["program_assignment_id"],
        ["id"],
    )
    op.create_index(
        "ix_workout_assignments_program_assignment_id",
        "workout_assignments",
        ["program_assignment_id"],
        unique=False,
    )
    op.create_index(
        "ix_workout_assignments_program_slot_id",
        "workout_assignments",
        ["program_slot_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_workout_assignments_program_slot_id", table_name="workout_assignments")
    op.drop_index("ix_workout_assignments_program_assignment_id", table_name="workout_assignments")
    op.drop_constraint(
        "fk_workout_assignments_program_assignment_id",
        "workout_assignments",
        type_="foreignkey",
    )
    op.drop_column("workout_assignments", "program_slot_id")
    op.drop_column("workout_assignments", "program_assignment_id")
    op.drop_table("program_assignments")
    op.drop_table("program_slots")
