from __future__ import annotations

from datetime import date

from toptrainers_api.modules.tasks.models import TaskTemplate
from toptrainers_api.modules.tasks.service import (
    build_task_snapshot_v1,
    materialize_task_assignment,
)


def test_task_assignment_snapshot_copies_typed_template_rules() -> None:
    template = TaskTemplate(
        id="t" * 36,
        trainer_id="r" * 36,
        title="Измерить бицепс",
        instruction="Замерьте руку в напряжении",
        result_schema={
            "fields": [
                {"kind": "measurement", "unit": "cm", "required": True},
                {"kind": "photo", "required": False},
            ]
        },
    )

    assert build_task_snapshot_v1(template) == {
        "schema_version": 1,
        "source_task_template_id": "t" * 36,
        "title": "Измерить бицепс",
        "instruction": "Замерьте руку в напряжении",
        "result_schema": {
            "fields": [
                {"kind": "measurement", "unit": "cm", "required": True},
                {"kind": "photo", "required": False},
            ]
        },
    }


def test_materialized_task_keeps_program_provenance_and_pending_status() -> None:
    template = TaskTemplate(
        id="t" * 36,
        trainer_id="r" * 36,
        title="Измерить бицепс",
        instruction="",
        result_schema={"fields": [{"kind": "measurement", "unit": "cm", "required": True}]},
    )

    assignment = materialize_task_assignment(
        template,
        relationship_id="r" * 36,
        scheduled_date=date(2026, 9, 22),
        program_assignment_id="p" * 36,
        program_slot_id="s" * 36,
    )

    assert assignment.status == "PENDING"
    assert assignment.source_task_template_id == "t" * 36
    assert assignment.program_assignment_id == "p" * 36
