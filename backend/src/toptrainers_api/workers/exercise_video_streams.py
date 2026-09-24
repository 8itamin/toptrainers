from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.db import get_session_factory
from toptrainers_api.modules.media import repository
from toptrainers_api.modules.media.hls import HlsStorage
from toptrainers_api.modules.media.models import ExerciseVideoStream
from toptrainers_api.modules.media.storage import PrivateS3Storage
from toptrainers_api.modules.media.transcoder import FfmpegTranscoder, TranscodeError

LEASE_DURATION = timedelta(minutes=15)
MAX_ATTEMPTS = 3
POLL_INTERVAL_SECONDS = 5


async def claim_next_exercise_video_stream(
    session: AsyncSession,
    now: datetime,
) -> ExerciseVideoStream | None:
    statement = (
        select(ExerciseVideoStream)
        .where(
            or_(
                ExerciseVideoStream.status == "PENDING",
                and_(
                    ExerciseVideoStream.status == "PROCESSING",
                    ExerciseVideoStream.lease_expires_at < now,
                ),
            )
        )
        .order_by(ExerciseVideoStream.source_media_id)
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    stream = await session.scalar(statement)
    if stream is None:
        return None
    stream.status = "PROCESSING"
    stream.attempt_count += 1
    stream.lease_expires_at = now + LEASE_DURATION
    stream.last_error_code = None
    await session.commit()
    return stream


async def run_exercise_video_stream_job(
    stream_id: str,
    storage: PrivateS3Storage,
    transcoder: FfmpegTranscoder,
) -> None:
    source_media = None
    try:
        async with get_session_factory()() as session:
            stream = await session.get(ExerciseVideoStream, stream_id)
            if stream is None or stream.status != "PROCESSING":
                return
            source_media = await repository.get_ready_exercise_video(session, stream_id)
        if source_media is None:
            await _mark_failed(stream_id, "SOURCE_UNAVAILABLE")
            return

        with TemporaryDirectory(prefix="exercise-hls-") as directory_name:
            work_directory = Path(directory_name)
            source_path = work_directory / "source"
            output_directory = work_directory / "output"
            output_directory.mkdir()
            storage.get_file(source_media.object_key, source_path)
            result = await asyncio.to_thread(transcoder.transcode, source_path, output_directory)
            manifest_key, segment_prefix = await asyncio.to_thread(
                HlsStorage(storage).write_stream,
                f"exercise-hls/{stream_id}",
                output_directory,
            )

        async with get_session_factory()() as session:
            stream = await session.get(ExerciseVideoStream, stream_id)
            if stream is None or stream.status != "PROCESSING":
                return
            stream.status = "READY"
            stream.manifest_key = manifest_key
            stream.segment_prefix = segment_prefix
            stream.duration_seconds = result.duration_seconds
            stream.lease_expires_at = None
            stream.last_error_code = None
            await session.commit()
    except TranscodeError:
        await _mark_failed(stream_id, "TRANSCODE_FAILED")
    except Exception:
        await _mark_failed(stream_id, "STREAM_PROCESSING_FAILED")


async def _mark_failed(stream_id: str, error_code: str) -> None:
    async with get_session_factory()() as session:
        stream = await session.get(ExerciseVideoStream, stream_id)
        if stream is None or stream.status != "PROCESSING":
            return
        stream.status = "FAILED" if stream.attempt_count >= MAX_ATTEMPTS else "PENDING"
        stream.lease_expires_at = None
        stream.last_error_code = error_code
        await session.commit()


async def process_next_exercise_video_stream() -> bool:
    async with get_session_factory()() as session:
        stream = await claim_next_exercise_video_stream(session, datetime.now(UTC))
    if stream is None:
        return False
    await run_exercise_video_stream_job(
        stream.source_media_id,
        PrivateS3Storage(),
        FfmpegTranscoder(),
    )
    return True


async def run_forever() -> None:
    while True:
        if not await process_next_exercise_video_stream():
            await asyncio.sleep(POLL_INTERVAL_SECONDS)


def main() -> None:
    asyncio.run(run_forever())


if __name__ == "__main__":
    main()
