from __future__ import annotations

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from toptrainers_api.modules.exercises import service
from toptrainers_api.modules.exercises.models import Exercise
from toptrainers_api.modules.exercises.schemas import (
    ExercisePatch,
    ExerciseThumbnailUploadRequest,
    ExerciseVideoUploadRequest,
)


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


class FakeStorage:
    def __init__(self) -> None:
        self.created: tuple[str, str, int] | None = None

    def create_upload_url(self, key: str, content_type: str, content_length: int) -> str:
        self.created = (key, content_type, content_length)
        return "https://s3.example/video-upload"


@pytest.mark.parametrize("content_type", ["video/mp4", "video/webm", "video/quicktime"])
def test_video_upload_accepts_allowed_content_types(content_type: str) -> None:
    request = ExerciseVideoUploadRequest(
        content_type=content_type,
        content_length=200 * 1024 * 1024,
    )

    assert request.content_type == content_type


def test_video_upload_rejects_more_than_200_mib() -> None:
    with pytest.raises(ValidationError):
        ExerciseVideoUploadRequest(
            content_type="video/mp4",
            content_length=200 * 1024 * 1024 + 1,
        )


@pytest.mark.asyncio
async def test_video_upload_uses_private_exercise_video_prefix() -> None:
    session = MemorySession()
    storage = FakeStorage()

    media, upload_url = await service.create_video_upload(
        session,  # type: ignore[arg-type]
        {"sub": "t" * 36, "role": "trainer"},
        ExerciseVideoUploadRequest(content_type="video/webm", content_length=123),
        storage,  # type: ignore[arg-type]
    )

    assert upload_url == "https://s3.example/video-upload"
    assert media.purpose == "EXERCISE_VIDEO"
    assert media.object_key.startswith(f"exercise-video/{'t' * 36}/")
    assert storage.created == (media.object_key, "video/webm", 123)


@pytest.mark.asyncio
async def test_thumbnail_upload_uses_private_exercise_thumbnail_prefix() -> None:
    session = MemorySession()
    storage = FakeStorage()

    media, upload_url = await service.create_thumbnail_upload(
        session,  # type: ignore[arg-type]
        {"sub": "t" * 36, "role": "trainer"},
        ExerciseThumbnailUploadRequest(content_type="image/jpeg", content_length=123),
        storage,  # type: ignore[arg-type]
    )

    assert upload_url == "https://s3.example/video-upload"
    assert media.purpose == "EXERCISE_THUMBNAIL"
    assert media.object_key.startswith(f"exercise-thumbnail/{'t' * 36}/")
    assert storage.created == (media.object_key, "image/jpeg", 123)


@pytest.mark.asyncio
async def test_patch_rejects_media_that_is_not_ready_owned_exercise_video(
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

    async def get_owned(*_args: object) -> Exercise:
        return exercise

    async def get_invalid_media(*_args: object, **_kwargs: object) -> None:
        return None

    monkeypatch.setattr(service.repository, "get_for_trainer", get_owned)
    monkeypatch.setattr(service.media_service, "get_ready_owned_media", get_invalid_media)

    with pytest.raises(HTTPException) as error:
        await service.update_exercise(
            MemorySession(),  # type: ignore[arg-type]
            {"sub": exercise.trainer_id, "role": "trainer"},
            exercise.id,
            ExercisePatch(video_media_id="m" * 36),
        )

    assert error.value.status_code == 422
    assert exercise.video_media_id is None


@pytest.mark.asyncio
async def test_patch_rejects_new_video_without_ready_thumbnail(
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

    async def get_owned(*_args: object) -> Exercise:
        return exercise

    async def get_valid_media(*_args: object, **_kwargs: object) -> object:
        return object()

    async def get_legacy_stream(*_args: object) -> None:
        return None

    monkeypatch.setattr(service.repository, "get_for_trainer", get_owned)
    monkeypatch.setattr(service.media_service, "get_ready_owned_media", get_valid_media)
    monkeypatch.setattr(service.media_service, "get_exercise_video_stream", get_legacy_stream)

    with pytest.raises(HTTPException) as error:
        await service.update_exercise(
            MemorySession(),  # type: ignore[arg-type]
            {"sub": exercise.trainer_id, "role": "trainer"},
            exercise.id,
            ExercisePatch(video_media_id="m" * 36),
        )

    assert error.value.status_code == 422
    assert exercise.video_media_id is None


@pytest.mark.asyncio
async def test_owner_video_preview_returns_linked_media_identity(
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
        video_media_id="m" * 36,
    )

    async def get_owned(*_args: object) -> Exercise:
        return exercise

    async def create_read_url(*_args: object, **_kwargs: object) -> str:
        return "https://s3.example/video-read"

    monkeypatch.setattr(service.repository, "get_for_trainer", get_owned)
    monkeypatch.setattr(service.media_service, "create_owner_read_url", create_read_url)

    result = await service.create_exercise_video_read_url(
        MemorySession(),  # type: ignore[arg-type]
        {"sub": exercise.trainer_id, "role": "trainer"},
        exercise.id,
        FakeStorage(),  # type: ignore[arg-type]
    )

    assert result == ("m" * 36, "https://s3.example/video-read")
