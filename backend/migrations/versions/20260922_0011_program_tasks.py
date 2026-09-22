"""Add typed task templates, assignments, and result versions.

Revision ID: 20260922_0011
Revises: 20260906_0010
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260922_0011"
down_revision = "20260906_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("uq_program_slots_program_week_day", "program_slots", type_="unique")
    op.add_column(
        "program_slots",
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "program_slots",
        sa.Column("kind", sa.String(length=16), nullable=False, server_default="WORKOUT"),
    )
    op.add_column(
        "program_slots",
        sa.Column("task_template_id", sa.String(length=36), nullable=True),
    )
    op.alter_column(
        "program_slots",
        "workout_id",
        existing_type=sa.String(length=36),
        nullable=True,
    )
    op.create_index(
        "ix_program_slots_task_template_id",
        "program_slots",
        ["task_template_id"],
        unique=False,
    )
    op.create_unique_constraint(
        "uq_program_slots_program_week_day_position",
        "program_slots",
        ["program_id", "week_number", "day_number", "position"],
    )
    op.create_check_constraint(
        "ck_program_slots_exact_target",
        "program_slots",
        "(kind = 'WORKOUT' AND workout_id IS NOT NULL AND task_template_id IS NULL) "
        "OR (kind = 'TASK' AND task_template_id IS NOT NULL AND workout_id IS NULL)",
    )

    op.create_table(
        "task_templates",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("trainer_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("instruction", sa.Text(), nullable=False, server_default=""),
        sa.Column("result_schema", postgresql.JSONB(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_task_templates_trainer_id", "task_templates", ["trainer_id"])

    op.create_table(
        "task_assignments",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("relationship_id", sa.String(length=36), nullable=False),
        sa.Column("source_task_template_id", sa.String(length=36), nullable=False),
        sa.Column("program_assignment_id", sa.String(length=36), nullable=True),
        sa.Column("program_slot_id", sa.String(length=36), nullable=True),
        sa.Column("scheduled_date", sa.Date(), nullable=False),
        sa.Column("task_snapshot", postgresql.JSONB(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.CheckConstraint(
            "status IN ('PENDING', 'COMPLETED', 'CANCELLED')",
            name="ck_task_assignments_status",
        ),
        sa.ForeignKeyConstraint(["relationship_id"], ["trainer_client_relationships.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_task_assignments_relationship_id", "task_assignments", ["relationship_id"])
    op.create_index(
        "ix_task_assignments_source_task_template_id",
        "task_assignments",
        ["source_task_template_id"],
    )
    op.create_index(
        "ix_task_assignments_program_assignment_id",
        "task_assignments",
        ["program_assignment_id"],
    )
    op.create_index("ix_task_assignments_program_slot_id", "task_assignments", ["program_slot_id"])
    op.create_index("ix_task_assignments_scheduled_date", "task_assignments", ["scheduled_date"])

    op.create_table(
        "task_result_versions",
        sa.Column("assignment_id", sa.String(length=36), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("request_id", sa.String(length=128), nullable=False),
        sa.Column("result_payload", postgresql.JSONB(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("version >= 1", name="ck_task_result_versions_version_positive"),
        sa.ForeignKeyConstraint(["assignment_id"], ["task_assignments.id"]),
        sa.PrimaryKeyConstraint("assignment_id", "version"),
        sa.UniqueConstraint(
            "assignment_id",
            "request_id",
            name="uq_task_result_versions_assignment_request_id",
        ),
    )


def downgrade() -> None:
    op.drop_table("task_result_versions")
    op.drop_index("ix_task_assignments_program_slot_id", table_name="task_assignments")
    op.drop_index("ix_task_assignments_program_assignment_id", table_name="task_assignments")
    op.drop_index("ix_task_assignments_source_task_template_id", table_name="task_assignments")
    op.drop_index("ix_task_assignments_scheduled_date", table_name="task_assignments")
    op.drop_index("ix_task_assignments_relationship_id", table_name="task_assignments")
    op.drop_table("task_assignments")
    op.drop_index("ix_task_templates_trainer_id", table_name="task_templates")
    op.drop_table("task_templates")

    op.drop_constraint("ck_program_slots_exact_target", "program_slots", type_="check")
    op.drop_constraint(
        "uq_program_slots_program_week_day_position",
        "program_slots",
        type_="unique",
    )
    op.drop_index("ix_program_slots_task_template_id", table_name="program_slots")
    op.alter_column(
        "program_slots",
        "workout_id",
        existing_type=sa.String(length=36),
        nullable=False,
    )
    op.drop_column("program_slots", "task_template_id")
    op.drop_column("program_slots", "kind")
    op.drop_column("program_slots", "position")
    op.create_unique_constraint(
        "uq_program_slots_program_week_day",
        "program_slots",
        ["program_id", "week_number", "day_number"],
    )
