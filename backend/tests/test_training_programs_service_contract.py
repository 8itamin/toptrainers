from toptrainers_api.modules.programs.models import Program, ProgramSlot
from toptrainers_api.modules.programs.service import to_response


def test_program_response_preserves_ordered_full_schedule() -> None:
    """A response that drops slots would make a full replacement destructive for clients."""
    program = Program(
        id="p" * 36,
        trainer_id="t" * 36,
        title="Base",
        description="",
        duration_weeks=2,
        slots=[
            ProgramSlot(
                id="s2" * 18,
                week_number=2,
                day_number=1,
                workout_id="w2" * 18,
            ),
            ProgramSlot(
                id="s1" * 18,
                week_number=1,
                day_number=3,
                workout_id="w1" * 18,
            ),
        ],
    )

    response = to_response(program)

    assert response.duration_weeks == 2
    assert [(slot.week_number, slot.day_number) for slot in response.slots] == [(2, 1), (1, 3)]


def test_program_response_preserves_task_target_and_position() -> None:
    program = Program(
        id="p" * 36,
        trainer_id="t" * 36,
        title="Контроль",
        description="",
        duration_weeks=1,
        slots=[
            ProgramSlot(
                id="s" * 36,
                week_number=1,
                day_number=2,
                position=3,
                kind="TASK",
                workout_id=None,
                task_template_id="a" * 36,
            )
        ],
    )

    [slot] = to_response(program).slots

    assert (slot.kind, slot.position, slot.workout_id, slot.task_template_id) == (
        "TASK",
        3,
        None,
        "a" * 36,
    )
