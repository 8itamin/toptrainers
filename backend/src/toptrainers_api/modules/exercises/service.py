from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.modules.exercises import repository
from toptrainers_api.modules.exercises.models import Exercise
from toptrainers_api.modules.exercises.schemas import (
    ExerciseCreate,
    ExercisePatch,
    ExerciseThumbnailReadUrlsRequest,
    ExerciseThumbnailUploadRequest,
    ExerciseVideoStreamStatus,
    ExerciseVideoUploadRequest,
)
from toptrainers_api.modules.media import service as media_service
from toptrainers_api.modules.media.models import (
    ExerciseThumbnailJob,
    ExerciseVideoStream,
    MediaObject,
)
from toptrainers_api.modules.media.storage import PrivateS3Storage


def require_trainer(account: dict[str, object]) -> str:
    if account.get("role") != "trainer":
        raise HTTPException(status_code=403, detail="Trainer role required")
    return str(account["sub"])


async def list_exercises(session: AsyncSession, account: dict[str, object]) -> list[Exercise]:
    return list(await repository.list_for_trainer(session, require_trainer(account)))


async def create_exercise(
    session: AsyncSession,
    account: dict[str, object],
    payload: ExerciseCreate,
) -> Exercise:
    exercise = Exercise(
        id=str(uuid4()),
        trainer_id=require_trainer(account),
        **payload.model_dump(),
        muscle_groups=[payload.muscle_group],
    )
    session.add(exercise)
    await session.commit()
    await session.refresh(exercise)
    return exercise


async def update_exercise(
    session: AsyncSession,
    account: dict[str, object],
    exercise_id: str,
    payload: ExercisePatch,
) -> Exercise:
    trainer_id = require_trainer(account)
    exercise = await repository.get_for_trainer(session, trainer_id, exercise_id)
    if exercise is None:
        raise HTTPException(status_code=404, detail="Exercise not found")

    values = payload.model_dump(exclude_unset=True)
    if "video_media_id" in values and values["video_media_id"] is not None:
        media = await media_service.get_ready_owned_media(
            session,
            trainer_id,
            values["video_media_id"],
            purpose=media_service.EXERCISE_VIDEO_POLICY.purpose,
        )
        if media is None:
            raise HTTPException(status_code=422, detail="Exercise video is not ready or not owned")
        stream = await media_service.get_exercise_video_stream(
            session,
            values["video_media_id"],
        )
        if stream is not None and stream.status != "READY":
            raise HTTPException(status_code=422, detail="Exercise video stream is not ready")
    if "thumbnail_media_id" in values and values["thumbnail_media_id"] is not None:
        media = await media_service.get_ready_owned_media(
            session,
            trainer_id,
            values["thumbnail_media_id"],
            purpose=media_service.EXERCISE_THUMBNAIL_POLICY.purpose,
        )
        if media is None:
            raise HTTPException(
                status_code=422,
                detail="Exercise thumbnail is not ready or not owned",
            )
    effective_video_media_id = values.get("video_media_id", exercise.video_media_id)
    effective_thumbnail_media_id = values.get("thumbnail_media_id", exercise.thumbnail_media_id)
    is_changing_video_or_thumbnail = (
        effective_video_media_id != exercise.video_media_id
        or effective_thumbnail_media_id != exercise.thumbnail_media_id
    )
    if (
        is_changing_video_or_thumbnail
        and effective_video_media_id is not None
        and effective_thumbnail_media_id is None
    ):
        raise HTTPException(status_code=422, detail="Exercise video requires a ready thumbnail")
    for field_name in ("title", "instruction", "video_media_id", "thumbnail_media_id"):
        if field_name in values:
            setattr(exercise, field_name, values[field_name])
    if "muscle_groups" in values:
        muscle_groups = values["muscle_groups"]
        assert isinstance(muscle_groups, list)
        exercise.muscle_groups = muscle_groups
        exercise.muscle_group = muscle_groups[0]

    await session.commit()
    await session.refresh(exercise)
    return exercise


async def create_video_upload(
    session: AsyncSession,
    account: dict[str, object],
    payload: ExerciseVideoUploadRequest,
    storage: PrivateS3Storage,
) -> tuple[MediaObject, str]:
    return await media_service.create_upload(
        session,
        require_trainer(account),
        payload,
        storage,
        policy=media_service.EXERCISE_VIDEO_POLICY,
    )


async def confirm_video_upload(
    session: AsyncSession,
    account: dict[str, object],
    media_id: str,
    storage: PrivateS3Storage,
) -> tuple[MediaObject, ExerciseVideoStream]:
    media = await media_service.confirm_upload(
        session,
        require_trainer(account),
        media_id,
        storage,
        purpose=media_service.EXERCISE_VIDEO_POLICY.purpose,
    )
    stream = await media_service.enqueue_exercise_video_stream(session, media.id)
    return media, stream


async def get_video_stream_status(
    session: AsyncSession,
    media_id: str | None,
) -> ExerciseVideoStreamStatus:
    if media_id is None:
        return "NONE"
    stream = await media_service.get_exercise_video_stream(session, media_id)
    if stream is None:
        return "NONE"
    if stream.status in {"PENDING", "PROCESSING"}:
        return "PROCESSING"
    if stream.status == "READY":
        return "READY"
    return "FAILED"


async def retry_video_stream(
    session: AsyncSession,
    account: dict[str, object],
    media_id: str,
) -> ExerciseVideoStream:
    trainer_id = require_trainer(account)
    media = await media_service.get_ready_owned_media(
        session,
        trainer_id,
        media_id,
        purpose=media_service.EXERCISE_VIDEO_POLICY.purpose,
    )
    if media is None:
        raise HTTPException(status_code=404, detail="Media object was not found")
    stream = await media_service.get_exercise_video_stream(session, media.id)
    if stream is None or stream.status != "FAILED":
        raise HTTPException(status_code=409, detail="Exercise video stream cannot be retried")
    stream.status = "PENDING"
    stream.lease_expires_at = None
    stream.last_error_code = None
    await session.commit()
    return stream


async def create_thumbnail_upload(
    session: AsyncSession,
    account: dict[str, object],
    payload: ExerciseThumbnailUploadRequest,
    storage: PrivateS3Storage,
) -> tuple[MediaObject, str]:
    return await media_service.create_upload(
        session,
        require_trainer(account),
        payload,
        storage,
        policy=media_service.EXERCISE_THUMBNAIL_POLICY,
    )


async def confirm_thumbnail_upload(
    session: AsyncSession,
    account: dict[str, object],
    media_id: str,
    storage: PrivateS3Storage,
) -> tuple[MediaObject, ExerciseThumbnailJob]:
    media = await media_service.confirm_upload(
        session,
        require_trainer(account),
        media_id,
        storage,
        purpose=media_service.EXERCISE_THUMBNAIL_POLICY.purpose,
        mark_ready=False,
    )
    job = await media_service.enqueue_exercise_thumbnail_job(session, media)
    return media, job


async def get_thumbnail_upload_status(
    session: AsyncSession,
    account: dict[str, object],
    media_id: str,
) -> ExerciseThumbnailJob:
    trainer_id = require_trainer(account)
    media = await media_service.get_owned_media(
        session,
        trainer_id,
        media_id,
        purpose=media_service.EXERCISE_THUMBNAIL_POLICY.purpose,
    )
    job = await media_service.get_exercise_thumbnail_job(session, media_id)
    if media is None:
        raise HTTPException(status_code=404, detail="Exercise thumbnail was not found")
    if job is None:
        raise HTTPException(status_code=404, detail="Exercise thumbnail processing was not found")
    return job


async def create_thumbnail_read_urls(
    session: AsyncSession,
    account: dict[str, object],
    payload: ExerciseThumbnailReadUrlsRequest,
    storage: PrivateS3Storage,
) -> list[tuple[str, str]]:
    trainer_id = require_trainer(account)
    exercises = await repository.list_for_trainer(session, trainer_id)
    owned_ids = {
        exercise.thumbnail_media_id
        for exercise in exercises
        if exercise.thumbnail_media_id is not None
    }
    results: list[tuple[str, str]] = []
    for media_id in payload.media_ids:
        if media_id not in owned_ids:
            continue
        try:
            read_url = await media_service.create_owner_read_url(
                session,
                trainer_id,
                media_id,
                storage,
                purpose=media_service.EXERCISE_THUMBNAIL_POLICY.purpose,
            )
        except HTTPException:
            continue
        results.append((media_id, read_url))
    return results


async def create_exercise_video_read_url(
    session: AsyncSession,
    account: dict[str, object],
    exercise_id: str,
    storage: PrivateS3Storage,
) -> tuple[str, str]:
    trainer_id = require_trainer(account)
    exercise = await repository.get_for_trainer(session, trainer_id, exercise_id)
    if exercise is None or exercise.video_media_id is None:
        raise HTTPException(status_code=404, detail="Exercise video was not found")
    read_url = await media_service.create_owner_read_url(
        session,
        trainer_id,
        exercise.video_media_id,
        storage,
        purpose=media_service.EXERCISE_VIDEO_POLICY.purpose,
    )
    return exercise.video_media_id, read_url


async def create_exercise_video_stream_manifest(
    session: AsyncSession,
    account: dict[str, object],
    exercise_id: str,
    storage: PrivateS3Storage,
) -> str:
    trainer_id = require_trainer(account)
    exercise = await repository.get_for_trainer(session, trainer_id, exercise_id)
    if exercise is None or exercise.video_media_id is None:
        raise HTTPException(status_code=404, detail="Exercise video was not found")
    return await media_service.create_authorized_stream_manifest(
        session,
        exercise.video_media_id,
        storage,
    )


async def create_exercise_thumbnail_read_url(
    session: AsyncSession,
    account: dict[str, object],
    exercise_id: str,
    storage: PrivateS3Storage,
) -> tuple[str, str]:
    trainer_id = require_trainer(account)
    exercise = await repository.get_for_trainer(session, trainer_id, exercise_id)
    if exercise is None or exercise.thumbnail_media_id is None:
        raise HTTPException(status_code=404, detail="Exercise thumbnail was not found")
    read_url = await media_service.create_owner_read_url(
        session,
        trainer_id,
        exercise.thumbnail_media_id,
        storage,
        purpose=media_service.EXERCISE_THUMBNAIL_POLICY.purpose,
    )
    return exercise.thumbnail_media_id, read_url


async def get_owned_exercise_ids(
    session: AsyncSession,
    trainer_id: str,
    exercise_ids: set[str],
) -> set[str]:
    """Public cross-module contract: return only exercises owned by this trainer."""
    return await repository.owned_ids(session, trainer_id, exercise_ids)


async def get_owned_exercises(
    session: AsyncSession,
    trainer_id: str,
    exercise_ids: set[str],
) -> list[Exercise]:
    """Public cross-module contract returning trainer-owned Exercise rows."""
    return list(await repository.owned_by_ids(session, trainer_id, exercise_ids))
