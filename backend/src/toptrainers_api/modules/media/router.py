from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.auth import current_account
from toptrainers_api.core.db import get_session
from toptrainers_api.modules.media import service
from toptrainers_api.modules.media.schemas import (
    ConfirmUploadResponse,
    CreateUploadRequest,
    CreateUploadResponse,
    MediaReadUrlResponse,
)
from toptrainers_api.modules.media.storage import PrivateS3Storage

router = APIRouter(prefix="/media", tags=["media"])


def _storage() -> PrivateS3Storage:
    return PrivateS3Storage()


@router.post("/uploads", response_model=CreateUploadResponse, status_code=201)
async def create_upload(
    payload: CreateUploadRequest,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> CreateUploadResponse:
    media, upload_url = await service.create_upload(
        session, str(account["sub"]), payload, _storage()
    )
    return CreateUploadResponse(
        media_id=media.id,
        upload_url=upload_url,
        upload_headers={"Content-Type": media.content_type},
        expires_in_seconds=service.upload_expires_in_seconds(),
    )


@router.post("/uploads/{media_id}/confirm", response_model=ConfirmUploadResponse)
async def confirm_upload(
    media_id: str,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> ConfirmUploadResponse:
    media = await service.confirm_upload(session, str(account["sub"]), media_id, _storage())
    return ConfirmUploadResponse(media_id=media.id, status="READY")


@router.post("/{media_id}/read-url", response_model=MediaReadUrlResponse)
async def create_read_url(
    media_id: str,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> MediaReadUrlResponse:
    read_url = await service.create_owner_read_url(
        session, str(account["sub"]), media_id, _storage()
    )
    return MediaReadUrlResponse(
        media_id=media_id,
        read_url=read_url,
        expires_in_seconds=service.read_expires_in_seconds(),
    )
