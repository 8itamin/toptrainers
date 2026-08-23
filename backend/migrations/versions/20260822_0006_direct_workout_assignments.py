"""Add direct workout assignments.

Revision ID: 20260822_0006
Revises: 20260822_0005
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260822_0006"
down_revision = "20260822_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workout_assignments",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("relationship_id", sa.String(length=36), nullable=False),
        sa.Column("source_workout_id", sa.String(length=36), nullable=False),
        sa.Column("request_id", sa.String(length=128), nullable=False),
        sa.Column("workout_snapshot", postgresql.JSONB(), nullable=False),
        sa.Column("snapshot_schema_version", sa.Integer(), nullable=False),
        sa.Column("scheduled_date", sa.Date(), nullable=False),
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
            "status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')",
            name="ck_workout_assignments_status",
        ),
        sa.CheckConstraint(
            "snapshot_schema_version = 1",
            name="ck_workout_assignments_snapshot_schema_version",
        ),
        sa.ForeignKeyConstraint(
            ["relationship_id"],
            ["trainer_client_relationships.id"],
        ),
        sa.ForeignKeyConstraint(["source_workout_id"], ["workouts.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "relationship_id",
            "request_id",
            name="uq_workout_assignments_relationship_request_id",
        ),
    )
    op.create_index(
        "ix_workout_assignments_relationship_id",
        "workout_assignments",
        ["relationship_id"],
        unique=False,
    )
    op.create_index(
        "ix_workout_assignments_source_workout_id",
        "workout_assignments",
        ["source_workout_id"],
        unique=False,
    )
    op.create_index(
        "ix_workout_assignments_scheduled_date",
        "workout_assignments",
        ["scheduled_date"],
        unique=False,
    )
    op.create_index(
        "ix_workout_assignments_status",
        "workout_assignments",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_workout_assignments_relationship_status",
        "workout_assignments",
        ["relationship_id", "status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("workout_assignments")
