from __future__ import annotations

import pytest
from fastapi import HTTPException

from toptrainers_api.modules.exercises import service
from toptrainers_api.modules.exercises.models import Exercise
from toptrainers_api.modules.exercises.schemas import ExercisePatch


class MemorySession:
    def __init__(self) -> None:
        self.commits = 0
        self.refreshed: list[object] = []

    async def commit(self) -> None:
        self.commits += 1

    async def refresh(self, value: object) -> None:
        self.refreshed.append(value)


@pytest.mark.asyncio
async def test_owner_persists_title_instruction_and_ordered_muscle_groups(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = MemorySession()
    exercise = Exercise(
        id="e" * 36,
        trainer_id="t" * 36,
        title="Старое название",
        direction="strength",
        muscle_group="Ноги",
        muscle_groups=["Ноги"],
        instruction="Старое описание",
    )

    async def get_owned(*_args: object) -> Exercise:
        return exercise

    monkeypatch.setattr(service.repository, "get_for_trainer", get_owned)

    updated = await service.update_exercise(
        session,  # type: ignore[arg-type]
        {"sub": exercise.trainer_id, "role": "trainer"},
        exercise.id,
        ExercisePatch(
            title="Присед со штангой",
            instruction="Держите спину ровной",
            muscle_groups=["Спина", "Руки"],
        ),
    )

    assert updated.title == "Присед со штангой"
    assert updated.instruction == "Держите спину ровной"
    assert updated.muscle_groups == ["Спина", "Руки"]
    assert updated.muscle_group == "Спина"
    assert session.commits == 1
    assert session.refreshed == [exercise]


@pytest.mark.asyncio
async def test_non_owner_cannot_update_exercise(monkeypatch: pytest.MonkeyPatch) -> None:
    async def get_missing(*_args: object) -> None:
        return None

    monkeypatch.setattr(service.repository, "get_for_trainer", get_missing)

    with pytest.raises(HTTPException) as error:
        await service.update_exercise(
            MemorySession(),  # type: ignore[arg-type]
            {"sub": "t" * 36, "role": "trainer"},
            "e" * 36,
            ExercisePatch(title="Новое название"),
        )

    assert error.value.status_code == 404
