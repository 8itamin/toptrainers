from __future__ import annotations

import pytest
from fastapi import HTTPException

from toptrainers_api.modules.exercises import service
from toptrainers_api.modules.exercises.models import Exercise
from toptrainers_api.modules.exercises.schemas import ExercisePatch
from toptrainers_api.modules.media.models import ExerciseVideoStream, MediaObject


class MemorySession:
    async def commit(self) -> None:
        return None

    async def refresh(self, _value: object) -> None:
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
async def test_confirmed_video_reports_processing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    media = ready_video()
    stream = ExerciseVideoStream(source_media_id=media.id, status="PENDING")

    async def confirm(*_args: object, **_kwargs: object) -> MediaObject:
        return media

    async def enqueue(*_args: object) -> ExerciseVideoStream:
        return stream

    monkeypatch.setattr(service.media_service, "confirm_upload", confirm)
    monkeypatch.setattr(service.media_service, "enqueue_exercise_video_stream", enqueue)

    _, confirmed_stream = await service.confirm_video_upload(
        MemorySession(),  # type: ignore[arg-type]
        {"sub": media.owner_id, "role": "trainer"},
        media.id,
        object(),  # type: ignore[arg-type]
    )

    assert confirmed_stream.status == "PENDING"


@pytest.mark.asyncio
async def test_update_rejects_processing_video_stream(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    exercise = Exercise(
        id="e" * 36,
        trainer_id="t" * 36,
        title="Жим лёжа",
        direction="strength",
        muscle_group="Грудь",
        muscle_groups=["Грудь"],
        instruction="",
    )

    async def get_exercise(*_args: object) -> Exercise:
        return exercise

    async def get_media(*_args: object, **_kwargs: object) -> object:
        return object()

    async def get_stream(*_args: object) -> ExerciseVideoStream:
        return ExerciseVideoStream(source_media_id="m" * 36, status="PROCESSING")

    monkeypatch.setattr(service.repository, "get_for_trainer", get_exercise)
    monkeypatch.setattr(service.media_service, "get_ready_owned_media", get_media)
    monkeypatch.setattr(service.media_service, "get_exercise_video_stream", get_stream)

    with pytest.raises(HTTPException, match="stream is not ready"):
        await service.update_exercise(
            MemorySession(),  # type: ignore[arg-type]
            {"sub": exercise.trainer_id, "role": "trainer"},
            exercise.id,
            ExercisePatch(video_media_id="m" * 36, thumbnail_media_id="n" * 36),
        )
