import inspect
from types import SimpleNamespace

import pytest

from toptrainers_api.modules.programs import service
from toptrainers_api.modules.programs.models import ProgramAssignmentStatus
from toptrainers_api.modules.programs.service import cancel_program_assignment


def test_program_parent_cancellation_is_a_separate_service_operation() -> None:
    """Parent cancellation must not be implemented by looping through public child endpoints."""
    parameters = inspect.signature(cancel_program_assignment).parameters

    assert list(parameters) == ["session", "account", "program_assignment_id"]


class MemorySession:
    def __init__(self) -> None:
        self.commits = 0

    async def commit(self) -> None:
        self.commits += 1

    async def refresh(self, value: object) -> None:
        return None


@pytest.mark.asyncio
async def test_parent_cancellation_cancels_pending_task_children(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    trainer_id = "t" * 36
    parent = SimpleNamespace(
        id="p" * 36,
        relationship_id="r" * 36,
        status=ProgramAssignmentStatus.ISSUED.value,
    )
    cancelled: list[str] = []

    async def get_parent(*args: object) -> object:
        return parent

    async def lock_relationship(*args: object) -> object:
        return SimpleNamespace(trainer_id=trainer_id)

    async def cancel_workouts(*args: object) -> None:
        cancelled.append("workouts")

    async def cancel_tasks(*args: object) -> None:
        cancelled.append("tasks")

    monkeypatch.setattr(service.repository, "get_program_assignment", get_parent)
    monkeypatch.setattr(service.repository, "lock_program_assignment", get_parent)
    monkeypatch.setattr(service.clients_service, "lock_relationship_with_client", lock_relationship)
    monkeypatch.setattr(service, "cancel_planned_for_program_assignment", cancel_workouts)
    monkeypatch.setattr(
        service.tasks_service,
        "cancel_pending_for_program_assignment",
        cancel_tasks,
    )

    session = MemorySession()
    result = await cancel_program_assignment(
        session,  # type: ignore[arg-type]
        {"role": "trainer", "sub": trainer_id},
        parent.id,
    )

    assert result is parent
    assert parent.status == ProgramAssignmentStatus.CANCELLED.value
    assert cancelled == ["workouts", "tasks"]
    assert session.commits == 1
