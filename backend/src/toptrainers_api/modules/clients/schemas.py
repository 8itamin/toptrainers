from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from toptrainers_api.modules.clients.models import InvitationStatus, RelationshipStatus


class CreateInvitationRequest(BaseModel):
    client_id: str = Field(min_length=1, max_length=36)


class ClientCardWrite(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)
    contact_email: EmailStr | None = None

    @field_validator("display_name", mode="before")
    @classmethod
    def trim_name(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("Name must be a string")
        return value.strip()

    @field_validator("contact_email", mode="before")
    @classmethod
    def normalize_email(cls, value: str | None) -> str | None:
        if value is not None and not isinstance(value, str):
            raise ValueError("Email must be a string")
        return value.strip().lower() if value else None


class ClientCardResponse(BaseModel):
    id: str
    display_name: str
    contact_email: str | None
    client_account_id: str | None
    relationship_id: str | None
    group: str
    created_at: datetime


class ClientCardPage(BaseModel):
    items: list[ClientCardResponse]
    next_cursor: str | None
    counts: dict[str, int]


class JoinTokenRequest(BaseModel):
    token: str = Field(min_length=32, max_length=128)


class JoinPreview(BaseModel):
    display_name: str
    email_required: bool


class IssuedJoinInvitation(BaseModel):
    id: str
    url: str
    expires_at: datetime
    delivery_status: str | None = None


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
