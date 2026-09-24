from __future__ import annotations

import pytest
from fastapi import HTTPException

from toptrainers_api.modules.media import service
from toptrainers_api.modules.media.models import MediaObject


class MemorySession:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.commits = 0

    def add(self, value: object) -> None:
        self.added.append(value)

    async def commit(self) -> None:
        self.commits += 1

    async def refresh(self, value: object) -> None:
        return None


def ready_video() -> MediaObject:
    return MediaObject(
        id="m" * 36,
        owner_id="t" * 36,
        object_key="exercise-video/t/video.mp4",
        content_type="video/mp4",
        content_length=123,
        purpose="EXERCISE_VIDEO",
        status="READY",
    )


@pytest.mark.asyncio
async def test_enqueue_creates_one_pending_stream_for_ready_exercise_video(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = MemorySession()
    media = ready_video()

    async def get_ready_video(*_args: object) -> MediaObject:
        return media

    async def no_existing_stream(*_args: object) -> None:
        return None

    monkeypatch.setattr(
        service.repository,
        "get_ready_exercise_video",
        get_ready_video,
        raising=False,
    )
    monkeypatch.setattr(
        service.repository,
        "get_exercise_video_stream",
        no_existing_stream,
        raising=False,
    )

    stream = await service.enqueue_exercise_video_stream(session, media.id)  # type: ignore[arg-type]

    assert stream.status == "PENDING"
    assert stream.source_media_id == media.id
    assert session.added == [stream]
    assert session.commits == 1


@pytest.mark.asyncio
async def test_enqueue_rejects_media_that_is_not_a_ready_exercise_video(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = MemorySession()

    async def get_ready_video(*_args: object) -> None:
        return None

    monkeypatch.setattr(
        service.repository,
        "get_ready_exercise_video",
        get_ready_video,
        raising=False,
    )

    with pytest.raises(HTTPException, match="not found"):
        await service.enqueue_exercise_video_stream(session, "m" * 36)  # type: ignore[arg-type]
