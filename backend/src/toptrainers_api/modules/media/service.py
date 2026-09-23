from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.modules.media import repository
from toptrainers_api.modules.media.models import MediaObject
from toptrainers_api.modules.media.schemas import CreateUploadRequest
from toptrainers_api.modules.media.storage import (
    READ_EXPIRES_SECONDS,
    UPLOAD_EXPIRES_SECONDS,
    PrivateS3Storage,
)


class UploadPayload(Protocol):
    @property
    def content_type(self) -> str: ...

    @property
    def content_length(self) -> int: ...


@dataclass(frozen=True)
class UploadPolicy:
    purpose: str
    key_prefix: str


TASK_PHOTO_POLICY = UploadPolicy(purpose="TASK_PHOTO", key_prefix="task-media")
EXERCISE_VIDEO_POLICY = UploadPolicy(purpose="EXERCISE_VIDEO", key_prefix="exercise-video")


def _not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Media object was not found")


async def create_upload(
    session: AsyncSession,
    owner_id: str,
    payload: CreateUploadRequest | UploadPayload,
    storage: PrivateS3Storage,
    policy: UploadPolicy = TASK_PHOTO_POLICY,
) -> tuple[MediaObject, str]:
    media = MediaObject(
        id=str(uuid4()),
        owner_id=owner_id,
        object_key=f"{policy.key_prefix}/{owner_id}/{uuid4()}",
        content_type=payload.content_type,
        content_length=payload.content_length,
        purpose=policy.purpose,
        status="PENDING",
    )
    upload_url = storage.create_upload_url(
        media.object_key, media.content_type, media.content_length
    )
    session.add(media)
    await session.commit()
    return media, upload_url


async def confirm_upload(
    session: AsyncSession,
    owner_id: str,
    media_id: str,
    storage: PrivateS3Storage,
    purpose: str | None = None,
) -> MediaObject:
    media = await repository.get_for_owner(session, owner_id, media_id)
    if media is None:
        raise _not_found()
    if purpose is not None and media.purpose != purpose:
        raise _not_found()
    if media.status == "READY":
        return media
    try:
        storage.confirm_object(media.object_key, media.content_type, media.content_length)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=502, detail="Media storage confirmation failed") from error
    media.status = "READY"
    media.confirmed_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(media)
    return media


async def create_owner_read_url(
    session: AsyncSession,
    owner_id: str,
    media_id: str,
    storage: PrivateS3Storage,
    purpose: str | None = None,
) -> str:
    media = await repository.get_ready_for_owner(session, owner_id, media_id)
    if media is None or (purpose is not None and media.purpose != purpose):
        raise _not_found()
    return storage.create_read_url(media.object_key)


async def create_authorized_read_url(
    session: AsyncSession,
    media_id: str,
    storage: PrivateS3Storage,
    purpose: str | None = None,
) -> str:
    """Create a read URL after the owning domain has independently authorized access."""
    media = await repository.get_ready(session, media_id)
    if media is None or (purpose is not None and media.purpose != purpose):
        raise _not_found()
    return storage.create_read_url(media.object_key)


async def get_ready_owned_media(
    session: AsyncSession,
    owner_id: str,
    media_id: str,
    purpose: str | None = None,
) -> MediaObject | None:
    """Public contract used by task result submission validation."""
    media = await repository.get_ready_for_owner(session, owner_id, media_id)
    if media is None or (purpose is not None and media.purpose != purpose):
        return None
    return media


def upload_expires_in_seconds() -> int:
    return UPLOAD_EXPIRES_SECONDS


def read_expires_in_seconds() -> int:
    return READ_EXPIRES_SECONDS
