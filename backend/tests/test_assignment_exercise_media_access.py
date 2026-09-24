from __future__ import annotations

from types import SimpleNamespace

import pytest

from toptrainers_api.core.errors import BusinessRuleError
from toptrainers_api.modules.assignments import service
from toptrainers_api.modules.clients.models import RelationshipStatus
from toptrainers_api.modules.media.schemas import MediaReadUrlsRequest


class FakeStorage:
    pass


@pytest.mark.asyncio
async def test_client_cannot_read_unreferenced_exercise_media(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    assignment = SimpleNamespace(
        id="a" * 36,
        relationship_id="r" * 36,
        workout_snapshot={
            "title": "Тренировка",
            "description": "",
            "blocks": [
                {
                    "kind": "main",
                    "position": 0,
                    "exercises": [
                        {
                            "source_exercise_id": "e" * 36,
                            "position": 0,
                            "title": "Жим",
                            "direction": "strength",
                            "muscle_group": "Грудь",
                            "instruction": "",
                            "sets": 3,
                            "reps": 10,
                            "video_media_id": "m" * 36,
                        }
                    ],
                }
            ],
        },
    )
    relationship = SimpleNamespace(
        id=assignment.relationship_id,
        client_id="c" * 36,
        status=RelationshipStatus.ACTIVE.value,
    )

    async def get_assignment(*_args: object) -> object:
        return assignment

    async def get_relationship(*_args: object) -> object:
        return relationship

    monkeypatch.setattr(service.repository, "get_assignment", get_assignment)
    monkeypatch.setattr(service.clients_service, "get_relationship", get_relationship)

    with pytest.raises(BusinessRuleError) as error:
        await service.create_assignment_exercise_media_read_url(
            object(),  # type: ignore[arg-type]
            {"sub": relationship.client_id, "role": "client"},
            assignment.id,
            "o" * 36,
            FakeStorage(),  # type: ignore[arg-type]
        )

    assert error.value.status_code == 404


@pytest.mark.asyncio
async def test_active_client_reads_media_referenced_by_frozen_snapshot(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    media_id = "m" * 36
    assignment = SimpleNamespace(
        id="a" * 36,
        relationship_id="r" * 36,
        workout_snapshot={
            "title": "Тренировка",
            "description": "",
            "blocks": [
                {
                    "kind": "main",
                    "position": 0,
                    "exercises": [
                        {
                            "source_exercise_id": "e" * 36,
                            "position": 0,
                            "title": "Жим",
                            "direction": "strength",
                            "muscle_group": "Грудь",
                            "instruction": "",
                            "sets": 3,
                            "reps": 10,
                            "video_media_id": media_id,
                        }
                    ],
                }
            ],
        },
    )
    relationship = SimpleNamespace(
        id=assignment.relationship_id,
        client_id="c" * 36,
        status=RelationshipStatus.ACTIVE.value,
    )

    async def get_assignment(*_args: object) -> object:
        return assignment

    async def get_relationship(*_args: object) -> object:
        return relationship

    async def create_read_url(*_args: object, **_kwargs: object) -> str:
        return "https://s3.example/frozen-video"

    monkeypatch.setattr(service.repository, "get_assignment", get_assignment)
    monkeypatch.setattr(service.clients_service, "get_relationship", get_relationship)
    monkeypatch.setattr(service.media_service, "create_authorized_read_url", create_read_url)

    read_url = await service.create_assignment_exercise_media_read_url(
        object(),  # type: ignore[arg-type]
        {"sub": relationship.client_id, "role": "client"},
        assignment.id,
        media_id,
        FakeStorage(),  # type: ignore[arg-type]
    )

    assert read_url == "https://s3.example/frozen-video"


@pytest.mark.asyncio
async def test_active_client_reads_thumbnail_referenced_by_frozen_snapshot(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    media_id = "n" * 36
    assignment = SimpleNamespace(
        id="a" * 36,
        relationship_id="r" * 36,
        workout_snapshot={
            "title": "Тренировка",
            "description": "",
            "blocks": [{"kind": "main", "position": 0, "exercises": [{
                "source_exercise_id": "e" * 36,
                "position": 0,
                "title": "Жим",
                "direction": "strength",
                "muscle_group": "Грудь",
                "instruction": "",
                "sets": 3,
                "reps": 10,
                "thumbnail_media_id": media_id,
            }]}],
        },
    )
    relationship = SimpleNamespace(
        id=assignment.relationship_id,
        client_id="c" * 36,
        status=RelationshipStatus.ACTIVE.value,
    )
    observed_purpose: str | None = None

    async def get_assignment(*_args: object) -> object:
        return assignment

    async def get_relationship(*_args: object) -> object:
        return relationship

    async def create_read_url(*_args: object, **kwargs: object) -> str:
        nonlocal observed_purpose
        observed_purpose = str(kwargs["purpose"])
        return "https://s3.example/frozen-thumbnail"

    monkeypatch.setattr(service.repository, "get_assignment", get_assignment)
    monkeypatch.setattr(service.clients_service, "get_relationship", get_relationship)
    monkeypatch.setattr(service.media_service, "create_authorized_read_url", create_read_url)

    read_url = await service.create_assignment_exercise_media_read_url(
        object(),  # type: ignore[arg-type]
        {"sub": relationship.client_id, "role": "client"},
        assignment.id,
        media_id,
        FakeStorage(),  # type: ignore[arg-type]
    )

    assert read_url == "https://s3.example/frozen-thumbnail"
    assert observed_purpose == "EXERCISE_THUMBNAIL"


@pytest.mark.asyncio
async def test_client_batch_reads_only_snapshot_thumbnails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    media_id = "n" * 36
    assignment = SimpleNamespace(
        id="a" * 36,
        relationship_id="r" * 36,
        workout_snapshot={
            "title": "Тренировка",
            "description": "",
            "blocks": [{"kind": "main", "position": 0, "exercises": [{
                "source_exercise_id": "e" * 36,
                "position": 0,
                "title": "Жим",
                "direction": "strength",
                "muscle_group": "Грудь",
                "instruction": "",
                "sets": 3,
                "reps": 10,
                "thumbnail_media_id": media_id,
            }]}],
        },
    )
    relationship = SimpleNamespace(
        id=assignment.relationship_id,
        client_id="c" * 36,
        status=RelationshipStatus.ACTIVE.value,
    )
    requested: list[str] = []

    async def get_assignment(*_args: object) -> object:
        return assignment

    async def get_relationship(*_args: object) -> object:
        return relationship

    async def create_read_url(*args: object, **_kwargs: object) -> str:
        requested.append(str(args[1]))
        return f"https://s3.example/{args[1]}"

    monkeypatch.setattr(service.repository, "get_assignment", get_assignment)
    monkeypatch.setattr(service.clients_service, "get_relationship", get_relationship)
    monkeypatch.setattr(service.media_service, "create_authorized_read_url", create_read_url)

    response = await service.create_assignment_exercise_thumbnail_read_urls(
        object(),  # type: ignore[arg-type]
        {"sub": relationship.client_id, "role": "client"},
        assignment.id,
        MediaReadUrlsRequest(media_ids=[media_id]),
        FakeStorage(),  # type: ignore[arg-type]
    )

    assert response == [(media_id, f"https://s3.example/{media_id}")]
    assert requested == [media_id]

    with pytest.raises(BusinessRuleError) as error:
        await service.create_assignment_exercise_thumbnail_read_urls(
            object(),  # type: ignore[arg-type]
            {"sub": relationship.client_id, "role": "client"},
            assignment.id,
            MediaReadUrlsRequest(media_ids=["o" * 36]),
            FakeStorage(),  # type: ignore[arg-type]
        )

    assert error.value.status_code == 404
    assert requested == [media_id]
