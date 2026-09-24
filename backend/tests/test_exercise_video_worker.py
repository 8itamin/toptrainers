from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from shutil import rmtree

import pytest

from toptrainers_api.modules.media.models import ExerciseVideoStream, MediaObject
from toptrainers_api.modules.media.transcoder import TranscodeError, TranscodeResult
from toptrainers_api.workers import exercise_video_streams as worker


class ClaimSession:
    def __init__(self, stream: ExerciseVideoStream | None) -> None:
        self.stream = stream
        self.commits = 0

    async def scalar(self, _statement: object) -> ExerciseVideoStream | None:
        return self.stream

    async def commit(self) -> None:
        self.commits += 1


class JobSession:
    def __init__(self, stream: ExerciseVideoStream) -> None:
        self.stream = stream
        self.commits = 0

    async def get(self, _model: object, stream_id: str) -> ExerciseVideoStream | None:
        return self.stream if stream_id == self.stream.source_media_id else None

    async def commit(self) -> None:
        self.commits += 1


class SessionContext:
    def __init__(self, session: JobSession) -> None:
        self.session = session

    async def __aenter__(self) -> JobSession:
        return self.session

    async def __aexit__(self, *_args: object) -> None:
        return None


class SessionFactory:
    def __init__(self, session: JobSession) -> None:
        self.session = session

    def __call__(self) -> SessionContext:
        return SessionContext(self.session)


class FakeStorage:
    def get_file(self, _object_key: str, local_path: Path) -> None:
        local_path.write_bytes(b"source")

    def put_file(self, _object_key: str, _local_path: Path, _content_type: str) -> None:
        return None


class SuccessfulTranscoder:
    def transcode(self, _source_path: Path, output_dir: Path) -> TranscodeResult:
        (output_dir / "playlist.m3u8").write_text(
            '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\nsegment_000.m4s\n',
            encoding="utf-8",
        )
        (output_dir / "init.mp4").write_bytes(b"init")
        (output_dir / "segment_000.m4s").write_bytes(b"segment")
        return TranscodeResult(duration_seconds=12, manifest_filename="playlist.m3u8")


class FailingTranscoder:
    def transcode(self, _source_path: Path, output_dir: Path) -> TranscodeResult:
        (output_dir / "partial.m4s").write_bytes(b"partial")
        raise TranscodeError("ffmpeg diagnostic output must never reach the client")


def source_video(media_id: str) -> MediaObject:
    return MediaObject(
        id=media_id,
        owner_id="t" * 36,
        object_key="exercise-video/trainer/source.mp4",
        content_type="video/mp4",
        content_length=123,
        purpose="EXERCISE_VIDEO",
        status="READY",
    )


@pytest.mark.asyncio
async def test_expired_processing_lease_is_claimed_once_for_retry() -> None:
    now = datetime.now(UTC)
    stream = ExerciseVideoStream(
        source_media_id="m" * 36,
        status="PROCESSING",
        attempt_count=1,
        lease_expires_at=now - timedelta(seconds=1),
    )
    session = ClaimSession(stream)

    claimed = await worker.claim_next_exercise_video_stream(session, now)  # type: ignore[arg-type]

    assert claimed is stream
    assert stream.status == "PROCESSING"
    assert stream.attempt_count == 2
    assert stream.lease_expires_at is not None and stream.lease_expires_at > now
    assert session.commits == 1


@pytest.mark.asyncio
async def test_worker_marks_claimed_job_ready(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    stream = ExerciseVideoStream(source_media_id="m" * 36, status="PROCESSING", attempt_count=1)
    session = JobSession(stream)
    monkeypatch.setattr(worker, "get_session_factory", lambda: SessionFactory(session))

    async def get_source(*_args: object) -> MediaObject:
        return source_video(stream.source_media_id)

    monkeypatch.setattr(worker.repository, "get_ready_exercise_video", get_source)
    monkeypatch.setattr(
        worker,
        "TemporaryDirectory",
        lambda **_kwargs: TemporaryDirectoryAt(tmp_path),
    )

    await worker.run_exercise_video_stream_job(
        stream.source_media_id,
        FakeStorage(),  # type: ignore[arg-type]
        SuccessfulTranscoder(),  # type: ignore[arg-type]
    )

    assert stream.status == "READY"
    assert stream.duration_seconds == 12
    assert stream.manifest_key == f"exercise-hls/{stream.source_media_id}/playlist.m3u8"
    assert stream.lease_expires_at is None


@pytest.mark.asyncio
async def test_failed_transcode_cleans_temp_files_and_hides_stderr(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    stream = ExerciseVideoStream(source_media_id="m" * 36, status="PROCESSING", attempt_count=3)
    session = JobSession(stream)
    monkeypatch.setattr(worker, "get_session_factory", lambda: SessionFactory(session))

    async def get_source(*_args: object) -> MediaObject:
        return source_video(stream.source_media_id)

    monkeypatch.setattr(worker.repository, "get_ready_exercise_video", get_source)
    monkeypatch.setattr(
        worker,
        "TemporaryDirectory",
        lambda **_kwargs: TemporaryDirectoryAt(tmp_path),
    )

    await worker.run_exercise_video_stream_job(
        stream.source_media_id,
        FakeStorage(),  # type: ignore[arg-type]
        FailingTranscoder(),  # type: ignore[arg-type]
    )

    assert stream.status == "FAILED"
    assert stream.last_error_code == "TRANSCODE_FAILED"
    assert not list(tmp_path.iterdir())


class TemporaryDirectoryAt:
    def __init__(self, path: Path) -> None:
        self.path = path

    def __enter__(self) -> str:
        return str(self.path)

    def __exit__(self, *_args: object) -> None:
        for path in self.path.iterdir():
            if path.is_dir():
                rmtree(path)
            else:
                path.unlink()
