"""Trainer contacts and single-use join invitations."""

import sqlalchemy as sa
from alembic import op

revision = "20261013_0018"
down_revision = "20260929_0017"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "trainer_client_cards",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("trainer_id", sa.String(36), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("display_name", sa.String(120), nullable=False),
        sa.Column("contact_email", sa.String(320)),
        sa.Column("client_account_id", sa.String(36), sa.ForeignKey("accounts.id")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("trainer_id", "client_account_id", name="uq_client_card_account"),
        sa.UniqueConstraint("trainer_id", "contact_email", name="uq_client_card_email"),
    )
    op.create_index("ix_trainer_client_cards_trainer_id", "trainer_client_cards", ["trainer_id"])
    op.create_table(
        "client_join_invitations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "card_id", sa.String(36), sa.ForeignKey("trainer_client_cards.id"), nullable=False
        ),
        sa.Column("token_hash", sa.String(64), unique=True, nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "relationship_id", sa.String(36), sa.ForeignKey("trainer_client_relationships.id")
        ),
        sa.CheckConstraint("status IN ('PENDING', 'ACCEPTED', 'CANCELLED')", name="ck_join_status"),
    )
    op.create_index("ix_client_join_invitations_card_id", "client_join_invitations", ["card_id"])
    op.create_index(
        "uq_join_pending_card",
        "client_join_invitations",
        ["card_id"],
        unique=True,
        postgresql_where=sa.text("status = 'PENDING'"),
    )
    op.execute(
        sa.text(
            "INSERT INTO trainer_client_cards "
            "(id, trainer_id, display_name, contact_email, client_account_id) "
            "SELECT gen_random_uuid()::text, p.trainer_id, left(a.email, 120), "
            "lower(a.email), p.client_id "
            "FROM (SELECT DISTINCT trainer_id, client_id FROM trainer_client_relationships) p "
            "JOIN accounts a ON a.id = p.client_id"
        )
    )


def downgrade():
    op.drop_table("client_join_invitations")
    op.drop_table("trainer_client_cards")
