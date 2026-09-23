from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.auth import current_account
from toptrainers_api.core.db import get_session
from toptrainers_api.modules.exercises import service
from toptrainers_api.modules.exercises.schemas import (
    ExerciseCreate,
    ExercisePatch,
    ExerciseResponse,
    ExerciseVideoUploadRequest,
)
from toptrainers_api.modules.media import service as media_service
from toptrainers_api.modules.media.schemas import (
    ConfirmUploadResponse,
    CreateUploadResponse,
    MediaReadUrlResponse,
)
from toptrainers_api.modules.media.storage import PrivateS3Storage

router = APIRouter(prefix="/exercises", tags=["exercises"])


def _storage() -> PrivateS3Storage:
    return PrivateS3Storage()


@router.get("", response_model=list[ExerciseResponse])
async def list_exercises(
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> list[ExerciseResponse]:
    rows = await service.list_exercises(session, account)
    return [ExerciseResponse.model_validate(row, from_attributes=True) for row in rows]


@router.post("", response_model=ExerciseResponse, status_code=201)
async def create_exercise(
    payload: ExerciseCreate,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> ExerciseResponse:
    exercise = await service.create_exercise(session, account, payload)
    return ExerciseResponse.model_validate(exercise, from_attributes=True)


@router.post("/video-uploads", response_model=CreateUploadResponse, status_code=201)
async def create_video_upload(
    payload: ExerciseVideoUploadRequest,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> CreateUploadResponse:
    media, upload_url = await service.create_video_upload(session, account, payload, _storage())
    return CreateUploadResponse(
        media_id=media.id,
        upload_url=upload_url,
        upload_headers={"Content-Type": media.content_type},
        expires_in_seconds=media_service.upload_expires_in_seconds(),
    )


@router.post("/video-uploads/{media_id}/confirm", response_model=ConfirmUploadResponse)
async def confirm_video_upload(
    media_id: str,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> ConfirmUploadResponse:
    media = await service.confirm_video_upload(session, account, media_id, _storage())
    return ConfirmUploadResponse(media_id=media.id, status="READY")


@router.patch("/{exercise_id}", response_model=ExerciseResponse)
async def update_exercise(
    exercise_id: str,
    payload: ExercisePatch,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> ExerciseResponse:
    exercise = await service.update_exercise(session, account, exercise_id, payload)
    return ExerciseResponse.model_validate(exercise, from_attributes=True)


@router.post("/{exercise_id}/video/read-url", response_model=MediaReadUrlResponse)
async def create_exercise_video_read_url(
    exercise_id: str,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> MediaReadUrlResponse:
    media_id, read_url = await service.create_exercise_video_read_url(
        session,
        account,
        exercise_id,
        _storage(),
    )
    return MediaReadUrlResponse(
        media_id=media_id,
        read_url=read_url,
        expires_in_seconds=media_service.read_expires_in_seconds(),
    )
