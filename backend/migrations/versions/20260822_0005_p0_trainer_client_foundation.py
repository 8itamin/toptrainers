"""Add P0 trainer-client invitations and relationships.

Revision ID: 20260822_0005
Revises: 20260813_0004
"""

import sqlalchemy as sa
from alembic import op

revision = "20260822_0005"
down_revision = "20260813_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "trainer_client_invitations",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("trainer_id", sa.String(length=36), nullable=False),
        sa.Column("client_id", sa.String(length=36), nullable=False),
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
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by_account_id", sa.String(length=36), nullable=True),
        sa.Column("resolution_reason", sa.String(length=64), nullable=True),
        sa.CheckConstraint(
            "trainer_id <> client_id",
            name="ck_trainer_client_invitations_distinct_accounts",
        ),
        sa.CheckConstraint(
            "status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED')",
            name="ck_trainer_client_invitations_status",
        ),
        sa.ForeignKeyConstraint(["trainer_id"], ["accounts.id"]),
        sa.ForeignKeyConstraint(["client_id"], ["accounts.id"]),
        sa.ForeignKeyConstraint(["resolved_by_account_id"], ["accounts.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_trainer_client_invitations_trainer_id",
        "trainer_client_invitations",
        ["trainer_id"],
        unique=False,
    )
    op.create_index(
        "ix_trainer_client_invitations_client_id",
        "trainer_client_invitations",
        ["client_id"],
        unique=False,
    )
    op.create_index(
        "ix_trainer_client_invitations_status",
        "trainer_client_invitations",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_trainer_client_invitations_pair",
        "trainer_client_invitations",
        ["trainer_id", "client_id"],
        unique=False,
    )
    op.create_index(
        "uq_trainer_client_invitations_pending_pair",
        "trainer_client_invitations",
        ["trainer_id", "client_id"],
        unique=True,
        postgresql_where=sa.text("status = 'PENDING'"),
    )

    op.create_table(
        "trainer_client_relationships",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("trainer_id", sa.String(length=36), nullable=False),
        sa.Column("client_id", sa.String(length=36), nullable=False),
        sa.Column("invitation_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("terminated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "trainer_id <> client_id",
            name="ck_trainer_client_relationships_distinct_accounts",
        ),
        sa.CheckConstraint(
            "status IN ('ACTIVE', 'TERMINATED')",
            name="ck_trainer_client_relationships_status",
        ),
        sa.ForeignKeyConstraint(["trainer_id"], ["accounts.id"]),
        sa.ForeignKeyConstraint(["client_id"], ["accounts.id"]),
        sa.ForeignKeyConstraint(["invitation_id"], ["trainer_client_invitations.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "invitation_id",
            name="uq_trainer_client_relationships_invitation_id",
        ),
    )
    op.create_index(
        "ix_trainer_client_relationships_trainer_id",
        "trainer_client_relationships",
        ["trainer_id"],
        unique=False,
    )
    op.create_index(
        "ix_trainer_client_relationships_client_id",
        "trainer_client_relationships",
        ["client_id"],
        unique=False,
    )
    op.create_index(
        "ix_trainer_client_relationships_status",
        "trainer_client_relationships",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_trainer_client_relationships_pair",
        "trainer_client_relationships",
        ["trainer_id", "client_id"],
        unique=False,
    )
    op.create_index(
        "uq_trainer_client_relationships_active_pair",
        "trainer_client_relationships",
        ["trainer_id", "client_id"],
        unique=True,
        postgresql_where=sa.text("status = 'ACTIVE'"),
    )


def downgrade() -> None:
    op.drop_table("trainer_client_relationships")
    op.drop_table("trainer_client_invitations")
