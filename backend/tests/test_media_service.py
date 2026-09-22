from __future__ import annotations

import pytest

from toptrainers_api.modules.media import service
from toptrainers_api.modules.media.schemas import CreateUploadRequest


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
        self.confirmed: tuple[str, str, int] | None = None

    def create_upload_url(self, key: str, content_type: str, content_length: int) -> str:
        self.created = (key, content_type, content_length)
        return "https://s3.example/upload"

    def confirm_object(self, key: str, content_type: str, content_length: int) -> None:
        self.confirmed = (key, content_type, content_length)


@pytest.mark.asyncio
async def test_create_and_confirm_upload_keeps_object_private_until_verified(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner_id = "c" * 36
    session = MemorySession()
    storage = FakeStorage()
    media, upload_url = await service.create_upload(
        session,  # type: ignore[arg-type]
        owner_id,
        CreateUploadRequest(content_type="image/webp", content_length=123),
        storage,  # type: ignore[arg-type]
    )

    assert upload_url == "https://s3.example/upload"
    assert media.status == "PENDING"
    assert media.object_key.startswith(f"task-media/{owner_id}/")
    assert storage.created == (media.object_key, "image/webp", 123)

    async def get_pending(*args: object) -> object:
        return media

    monkeypatch.setattr(service.repository, "get_for_owner", get_pending)
    confirmed = await service.confirm_upload(
        session,  # type: ignore[arg-type]
        owner_id,
        media.id,
        storage,  # type: ignore[arg-type]
    )

    assert confirmed.status == "READY"
    assert storage.confirmed == (media.object_key, "image/webp", 123)
    assert session.commits == 2
