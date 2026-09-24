from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.db import get_session_factory
from toptrainers_api.modules.media import repository
from toptrainers_api.modules.media.models import ExerciseThumbnailJob
from toptrainers_api.modules.media.storage import PrivateS3Storage
from toptrainers_api.modules.media.thumbnails import (
    ThumbnailTranscodeError,
    WebpThumbnailTranscoder,
)

LEASE_DURATION = timedelta(minutes=15)
MAX_ATTEMPTS = 3
POLL_INTERVAL_SECONDS = 5


async def claim_next_exercise_thumbnail_job(
    session: AsyncSession,
    now: datetime,
) -> ExerciseThumbnailJob | None:
    job = await session.scalar(
        select(ExerciseThumbnailJob)
        .where(
            or_(
                ExerciseThumbnailJob.status == "PENDING",
                and_(
                    ExerciseThumbnailJob.status == "PROCESSING",
                    ExerciseThumbnailJob.lease_expires_at < now,
                ),
            )
        )
        .order_by(ExerciseThumbnailJob.source_media_id)
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    if job is None:
        return None
    job.status = "PROCESSING"
    job.attempt_count += 1
    job.lease_expires_at = now + LEASE_DURATION
    job.last_error_code = None
    await session.commit()
    return job


async def run_exercise_thumbnail_job(
    media_id: str,
    storage: PrivateS3Storage,
    transcoder: WebpThumbnailTranscoder,
) -> None:
    try:
        async with get_session_factory()() as session:
            job = await session.get(ExerciseThumbnailJob, media_id)
            media = await repository.get_exercise_thumbnail(session, media_id)
            if job is None or media is None or job.status != "PROCESSING":
                return

        with TemporaryDirectory(prefix="exercise-thumbnail-") as directory_name:
            directory = Path(directory_name)
            source = directory / "source"
            output = directory / "cover.webp"
            storage.get_file(media.object_key, source)
            content_length = await asyncio.to_thread(transcoder.transcode, source, output)
            storage.put_file(media.object_key, output, "image/webp")

        async with get_session_factory()() as session:
            job = await session.get(ExerciseThumbnailJob, media_id)
            media = await repository.get_exercise_thumbnail(session, media_id)
            if job is None or media is None or job.status != "PROCESSING":
                return
            job.status = "READY"
            job.lease_expires_at = None
            job.last_error_code = None
            media.status = "READY"
            media.content_type = "image/webp"
            media.content_length = content_length
            await session.commit()
    except ThumbnailTranscodeError as error:
        await _mark_failed(media_id, str(error))
    except Exception:
        await _mark_failed(media_id, "THUMBNAIL_PROCESSING_FAILED")


async def _mark_failed(media_id: str, error_code: str) -> None:
    async with get_session_factory()() as session:
        job = await session.get(ExerciseThumbnailJob, media_id)
        media = await repository.get_exercise_thumbnail(session, media_id)
        if job is None or media is None or job.status != "PROCESSING":
            return
        terminal = job.attempt_count >= MAX_ATTEMPTS
        job.status = "FAILED" if terminal else "PENDING"
        job.lease_expires_at = None
        job.last_error_code = error_code
        media.status = "FAILED" if terminal else "PENDING"
        await session.commit()


async def process_next_exercise_thumbnail_job() -> bool:
    async with get_session_factory()() as session:
        job = await claim_next_exercise_thumbnail_job(session, datetime.now(UTC))
    if job is None:
        return False
    await run_exercise_thumbnail_job(
        job.source_media_id,
        PrivateS3Storage(),
        WebpThumbnailTranscoder(),
    )
    return True


async def run_forever() -> None:
    while True:
        if not await process_next_exercise_thumbnail_job():
            await asyncio.sleep(POLL_INTERVAL_SECONDS)


def main() -> None:
    asyncio.run(run_forever())


if __name__ == "__main__":
    main()
