from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

ImageContentType = Literal["image/jpeg", "image/png", "image/webp"]


class CreateUploadRequest(BaseModel):
    content_type: ImageContentType
    content_length: int = Field(gt=0, le=10 * 1024 * 1024)


class CreateUploadResponse(BaseModel):
    media_id: str
    upload_url: str
    upload_headers: dict[str, str]
    expires_in_seconds: int


class ConfirmUploadResponse(BaseModel):
    media_id: str
    status: Literal["READY"]


class MediaReadUrlResponse(BaseModel):
    media_id: str
    read_url: str
    expires_in_seconds: int


class MediaReadUrlsRequest(BaseModel):
    media_ids: list[str] = Field(min_length=1, max_length=200)

    @field_validator("media_ids")
    @classmethod
    def _validate_ids(cls, value: list[str]) -> list[str]:
        if len(value) != len(set(value)):
            raise ValueError("media_ids must be unique")
        if any(len(media_id) != 36 for media_id in value):
            raise ValueError("media_ids must contain UUID values")
        return value
