from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

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
