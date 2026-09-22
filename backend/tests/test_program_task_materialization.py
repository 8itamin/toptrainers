from __future__ import annotations

from datetime import date
from types import SimpleNamespace

import pytest

from toptrainers_api.modules.programs import service as programs_service
from toptrainers_api.modules.programs.models import Program, ProgramSlot
from toptrainers_api.modules.programs.schemas import IssueProgramRequest
from toptrainers_api.modules.tasks import service as tasks_service
from toptrainers_api.modules.tasks.models import TaskAssignment, TaskTemplate


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


@pytest.mark.asyncio
async def test_issuing_program_materializes_task_child_from_frozen_template(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    trainer_id = "t" * 36
    relationship = SimpleNamespace(id="r" * 36)
    template = TaskTemplate(
        id="a" * 36,
        trainer_id=trainer_id,
        title="Измерить бицепс",
        instruction="",
        result_schema={"fields": [{"kind": "measurement", "unit": "cm"}]},
    )
    program = Program(
        id="p" * 36,
        trainer_id=trainer_id,
        title="Контроль",
        description="",
        duration_weeks=1,
        slots=[
            ProgramSlot(
                id="s" * 36,
                week_number=1,
                day_number=3,
                position=0,
                kind="TASK",
                workout_id=None,
                task_template_id=template.id,
            )
        ],
    )
    captured: dict[str, object] = {}

    async def lock_active_relationship(*args: object) -> object:
        return relationship

    async def lock_program(*args: object) -> Program:
        return program

    async def no_existing_assignment(*args: object) -> None:
        return None

    async def get_owned_template(*args: object) -> TaskTemplate:
        return template

    def materialize_task(template_arg: TaskTemplate, **kwargs: object) -> TaskAssignment:
        captured["template"] = template_arg
        captured.update(kwargs)
        return TaskAssignment(
            id="x" * 36,
            relationship_id=str(kwargs["relationship_id"]),
            source_task_template_id=template_arg.id,
            program_assignment_id=str(kwargs["program_assignment_id"]),
            program_slot_id=str(kwargs["program_slot_id"]),
            scheduled_date=kwargs["scheduled_date"],
            task_snapshot=tasks_service.build_task_snapshot_v1(template_arg),
            status="PENDING",
        )

    async def unexpected_workout_assignment(*args: object, **kwargs: object) -> None:
        raise AssertionError("A TASK schedule item must not create a workout assignment")

    monkeypatch.setattr(
        programs_service.clients_service,
        "lock_active_relationship_for_trainer_client",
        lock_active_relationship,
    )
    monkeypatch.setattr(programs_service.repository, "lock_owned_program", lock_program)
    monkeypatch.setattr(
        programs_service.repository,
        "get_assignment_by_request_id",
        no_existing_assignment,
    )
    monkeypatch.setattr(tasks_service, "get_owned_task_template", get_owned_template, raising=False)
    monkeypatch.setattr(
        programs_service,
        "materialize_task_assignment",
        materialize_task,
        raising=False,
    )
    monkeypatch.setattr(
        programs_service,
        "materialize_assignment",
        unexpected_workout_assignment,
    )

    session = MemorySession()
    parent = await programs_service.issue_program(
        session,  # type: ignore[arg-type]
        {"role": "trainer", "sub": trainer_id},
        program.id,
        IssueProgramRequest(
            client_id="c" * 36,
            start_date=date(2026, 10, 1),
            request_id="task-program-1",
        ),
    )

    assert captured["template"] is template
    assert captured["relationship_id"] == relationship.id
    assert captured["scheduled_date"] == date(2026, 10, 3)
    assert captured["program_assignment_id"] == parent.id
    assert captured["program_slot_id"] == program.slots[0].id
    assert len(session.added) == 2
    assert session.commits == 1
