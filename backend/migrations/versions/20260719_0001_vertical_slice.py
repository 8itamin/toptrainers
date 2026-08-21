"""Create accounts and trainer programs.

Revision ID: 20260719_0001
"""
import sqlalchemy as sa
from alembic import op

revision = "20260719_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=128), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_accounts_email", "accounts", ["email"], unique=False)
    op.create_index("ix_accounts_role", "accounts", ["role"], unique=False)
    op.create_table(
        "programs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("trainer_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("weeks", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_programs_trainer_id", "programs", ["trainer_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_programs_trainer_id", table_name="programs")
    op.drop_table("programs")
    op.drop_index("ix_accounts_role", table_name="accounts")
    op.drop_index("ix_accounts_email", table_name="accounts")
    op.drop_table("accounts")
