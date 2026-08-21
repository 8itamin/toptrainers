from sqlalchemy import CheckConstraint, Index, UniqueConstraint

from toptrainers_api.modules.clients.models import (
    InvitationStatus,
    RelationshipStatus,
    TrainerClientInvitation,
    TrainerClientRelationship,
)
from toptrainers_api.modules.clients.schemas import CreateInvitationRequest


def test_domain_status_values_are_stable_strings() -> None:
    assert [status.value for status in InvitationStatus] == [
        "PENDING",
        "ACCEPTED",
        "REJECTED",
        "CANCELLED",
    ]
    assert [status.value for status in RelationshipStatus] == [
        "ACTIVE",
        "TERMINATED",
    ]


def test_create_invitation_request_accepts_client_id() -> None:
    payload = CreateInvitationRequest(client_id="client-1")
    assert payload.client_id == "client-1"


def test_invitation_table_contains_pair_and_status_constraints() -> None:
    constraints = {
        constraint.name
        for constraint in TrainerClientInvitation.__table__.constraints
        if isinstance(constraint, CheckConstraint)
    }
    indexes = {
        index.name: index
        for index in TrainerClientInvitation.__table__.indexes
        if isinstance(index, Index)
    }
    assert "ck_trainer_client_invitations_distinct_accounts" in constraints
    assert "ck_trainer_client_invitations_status" in constraints
    assert "uq_trainer_client_invitations_pending_pair" in indexes


def test_relationship_table_contains_active_pair_and_source_uniqueness() -> None:
    constraints = {
        constraint.name
        for constraint in TrainerClientRelationship.__table__.constraints
        if isinstance(constraint, CheckConstraint)
    }
    indexes = {
        index.name: index
        for index in TrainerClientRelationship.__table__.indexes
        if isinstance(index, Index)
    }
    unique_constraints = {
        constraint.name
        for constraint in TrainerClientRelationship.__table__.constraints
        if isinstance(constraint, UniqueConstraint)
    }
    assert "ck_trainer_client_relationships_distinct_accounts" in constraints
    assert "ck_trainer_client_relationships_status" in constraints
    assert "uq_trainer_client_relationships_active_pair" in indexes
    assert "uq_trainer_client_relationships_invitation_id" in unique_constraints
