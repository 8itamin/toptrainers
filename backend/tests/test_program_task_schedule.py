from __future__ import annotations

import pytest
from pydantic import ValidationError

from toptrainers_api.modules.programs.models import Program, ProgramSlot
from toptrainers_api.modules.programs.schemas import ProgramCreate, ProgramScheduleItemWrite
from toptrainers_api.modules.programs.service import _program_snapshot_v1, _slots


def test_program_allows_one_workout_and_two_tasks_on_the_same_day() -> None:
    payload = ProgramCreate(
        title="Гипертрофия",
        duration_weeks=1,
        slots=[
            ProgramScheduleItemWrite(
                week_number=1,
                day_number=1,
                position=0,
                kind="WORKOUT",
                workout_id="w" * 36,
            ),
            ProgramScheduleItemWrite(
                week_number=1,
                day_number=1,
                position=1,
                kind="TASK",
                task_template_id="a" * 36,
            ),
            ProgramScheduleItemWrite(
                week_number=1,
                day_number=1,
                position=2,
                kind="TASK",
                task_template_id="b" * 36,
            ),
        ],
    )

    assert [item.kind for item in payload.slots] == ["WORKOUT", "TASK", "TASK"]


def test_program_rejects_duplicate_day_position() -> None:
    with pytest.raises(ValidationError):
        ProgramCreate(
            title="Гипертрофия",
            duration_weeks=1,
            slots=[
                ProgramScheduleItemWrite(
                    week_number=1,
                    day_number=1,
                    position=0,
                    kind="WORKOUT",
                    workout_id="w" * 36,
                ),
                ProgramScheduleItemWrite(
                    week_number=1,
                    day_number=1,
                    position=0,
                    kind="TASK",
                    task_template_id="a" * 36,
                ),
            ],
        )


def test_program_slot_persists_order_and_exactly_one_target_kind() -> None:
    table = ProgramSlot.__table__

    assert {"position", "kind", "task_template_id"} <= set(table.c.keys())
    assert table.c.workout_id.nullable is True
    assert table.c.task_template_id.nullable is True


def test_program_slot_builder_keeps_task_kind_and_position() -> None:
    payload = ProgramCreate(
        title="Гипертрофия",
        slots=[
            ProgramScheduleItemWrite(
                week_number=1,
                day_number=1,
                position=3,
                kind="TASK",
                task_template_id="a" * 36,
            )
        ],
    )

    [slot] = _slots(payload)

    assert (slot.kind, slot.position, slot.workout_id, slot.task_template_id) == (
        "TASK",
        3,
        None,
        "a" * 36,
    )


def test_program_snapshot_keeps_task_schedule_item() -> None:
    program = Program(
        id="p" * 36,
        trainer_id="t" * 36,
        title="Гипертрофия",
        description="",
        duration_weeks=1,
        slots=_slots(
            ProgramCreate(
                title="Гипертрофия",
                slots=[
                    ProgramScheduleItemWrite(
                        week_number=1,
                        day_number=4,
                        position=2,
                        kind="TASK",
                        task_template_id="a" * 36,
                    )
                ],
            )
        ),
    )

    [slot] = _program_snapshot_v1(program)["slots"]

    assert slot == {
        "slot_id": program.slots[0].id,
        "week_number": 1,
        "day_number": 4,
        "position": 2,
        "kind": "TASK",
        "workout_id": None,
        "task_template_id": "a" * 36,
    }
