from typing import cast

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.modules.media.models import (
    ExerciseThumbnailJob,
    ExerciseVideoStream,
    MediaObject,
)


async def get_for_owner(
    session: AsyncSession,
    owner_id: str,
    media_id: str,
) -> MediaObject | None:
    return cast(
        MediaObject | None,
        await session.scalar(
            select(MediaObject).where(MediaObject.id == media_id, MediaObject.owner_id == owner_id)
        ),
    )


async def get_ready_for_owner(
    session: AsyncSession,
    owner_id: str,
    media_id: str,
) -> MediaObject | None:
    return cast(
        MediaObject | None,
        await session.scalar(
            select(MediaObject).where(
                MediaObject.id == media_id,
                MediaObject.owner_id == owner_id,
                MediaObject.status == "READY",
            )
        ),
    )


async def get_ready(session: AsyncSession, media_id: str) -> MediaObject | None:
    return cast(
        MediaObject | None,
        await session.scalar(
            select(MediaObject).where(MediaObject.id == media_id, MediaObject.status == "READY")
        ),
    )


async def get_ready_exercise_video(session: AsyncSession, media_id: str) -> MediaObject | None:
    return cast(
        MediaObject | None,
        await session.scalar(
            select(MediaObject).where(
                MediaObject.id == media_id,
                MediaObject.status == "READY",
                MediaObject.purpose == "EXERCISE_VIDEO",
            )
        ),
    )


async def get_exercise_thumbnail(session: AsyncSession, media_id: str) -> MediaObject | None:
    return cast(
        MediaObject | None,
        await session.scalar(
            select(MediaObject).where(
                MediaObject.id == media_id,
                MediaObject.purpose == "EXERCISE_THUMBNAIL",
            )
        ),
    )


async def get_exercise_video_stream(
    session: AsyncSession,
    media_id: str,
) -> ExerciseVideoStream | None:
    return cast(
        ExerciseVideoStream | None,
        await session.scalar(
            select(ExerciseVideoStream).where(ExerciseVideoStream.source_media_id == media_id)
        ),
    )


async def get_exercise_thumbnail_job(
    session: AsyncSession,
    media_id: str,
) -> ExerciseThumbnailJob | None:
    return cast(
        ExerciseThumbnailJob | None,
        await session.scalar(
            select(ExerciseThumbnailJob).where(
                ExerciseThumbnailJob.source_media_id == media_id
            )
        ),
    )


async def get_ready_exercise_video_stream(
    session: AsyncSession,
    media_id: str,
) -> ExerciseVideoStream | None:
    return cast(
        ExerciseVideoStream | None,
        await session.scalar(
            select(ExerciseVideoStream).where(
                ExerciseVideoStream.source_media_id == media_id,
                ExerciseVideoStream.status == "READY",
            )
        ),
    )
