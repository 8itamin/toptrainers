from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.auth import current_account
from toptrainers_api.core.db import get_session
from toptrainers_api.modules.exercises import service
from toptrainers_api.modules.exercises.schemas import (
    ExerciseCreate,
    ExercisePatch,
    ExerciseResponse,
    ExerciseThumbnailUploadRequest,
    ExerciseVideoConfirmResponse,
    ExerciseVideoStreamStatus,
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


async def _response(session: AsyncSession, exercise: object) -> ExerciseResponse:
    response = ExerciseResponse.model_validate(exercise, from_attributes=True)
    return response.model_copy(
        update={
            "video_stream_status": await service.get_video_stream_status(
                session,
                response.video_media_id,
            )
        }
    )


@router.get("", response_model=list[ExerciseResponse])
async def list_exercises(
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> list[ExerciseResponse]:
    rows = await service.list_exercises(session, account)
    return [await _response(session, row) for row in rows]


@router.post("", response_model=ExerciseResponse, status_code=201)
async def create_exercise(
    payload: ExerciseCreate,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> ExerciseResponse:
    exercise = await service.create_exercise(session, account, payload)
    return await _response(session, exercise)


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


@router.post("/video-uploads/{media_id}/confirm", response_model=ExerciseVideoConfirmResponse)
async def confirm_video_upload(
    media_id: str,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> ExerciseVideoConfirmResponse:
    media, stream = await service.confirm_video_upload(session, account, media_id, _storage())
    stream_status: ExerciseVideoStreamStatus = (
        "READY" if stream.status == "READY" else "PROCESSING"
    )
    return ExerciseVideoConfirmResponse(
        media_id=media.id,
        status="READY",
        stream_status=stream_status,
    )


@router.post("/video-uploads/{media_id}/retry-stream", response_model=ExerciseVideoConfirmResponse)
async def retry_video_stream(
    media_id: str,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> ExerciseVideoConfirmResponse:
    await service.retry_video_stream(session, account, media_id)
    stream_status: ExerciseVideoStreamStatus = "PROCESSING"
    return ExerciseVideoConfirmResponse(
        media_id=media_id,
        status="READY",
        stream_status=stream_status,
    )


@router.post("/thumbnail-uploads", response_model=CreateUploadResponse, status_code=201)
async def create_thumbnail_upload(
    payload: ExerciseThumbnailUploadRequest,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> CreateUploadResponse:
    media, upload_url = await service.create_thumbnail_upload(session, account, payload, _storage())
    return CreateUploadResponse(
        media_id=media.id,
        upload_url=upload_url,
        upload_headers={"Content-Type": media.content_type},
        expires_in_seconds=media_service.upload_expires_in_seconds(),
    )


@router.post("/thumbnail-uploads/{media_id}/confirm", response_model=ConfirmUploadResponse)
async def confirm_thumbnail_upload(
    media_id: str,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> ConfirmUploadResponse:
    media = await service.confirm_thumbnail_upload(session, account, media_id, _storage())
    return ConfirmUploadResponse(media_id=media.id, status="READY")


@router.patch("/{exercise_id}", response_model=ExerciseResponse)
async def update_exercise(
    exercise_id: str,
    payload: ExercisePatch,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> ExerciseResponse:
    exercise = await service.update_exercise(session, account, exercise_id, payload)
    return await _response(session, exercise)


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


@router.get("/{exercise_id}/video/stream.m3u8", response_class=Response)
async def get_exercise_video_stream_manifest(
    exercise_id: str,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> Response:
    manifest = await service.create_exercise_video_stream_manifest(
        session, account, exercise_id, _storage()
    )
    return Response(
        content=manifest,
        media_type="application/vnd.apple.mpegurl",
        headers={"Cache-Control": "no-store"},
    )


@router.post("/{exercise_id}/thumbnail/read-url", response_model=MediaReadUrlResponse)
async def create_exercise_thumbnail_read_url(
    exercise_id: str,
    account: dict[str, object] = Depends(current_account),
    session: AsyncSession = Depends(get_session),
) -> MediaReadUrlResponse:
    media_id, read_url = await service.create_exercise_thumbnail_read_url(
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
