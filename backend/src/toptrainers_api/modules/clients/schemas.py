from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from toptrainers_api.modules.clients.models import InvitationStatus, RelationshipStatus


class CreateInvitationRequest(BaseModel):
    client_id: str = Field(min_length=1, max_length=36)


class InvitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    trainer_id: str
    client_id: str
    status: InvitationStatus
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None
    resolved_by_account_id: str | None
    resolution_reason: str | None


class RelationshipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    trainer_id: str
    client_id: str
    invitation_id: str
    status: RelationshipStatus
    created_at: datetime
    terminated_at: datetime | None
