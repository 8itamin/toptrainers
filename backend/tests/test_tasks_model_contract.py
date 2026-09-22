from __future__ import annotations

import pytest
from pydantic import ValidationError

from toptrainers_api.modules.tasks.models import TaskAssignment, TaskResultVersion, TaskTemplate
from toptrainers_api.modules.tasks.schemas import (
    MeasurementResultField,
    TaskTemplateWrite,
)


def test_result_versions_use_assignment_and_version_as_the_natural_key() -> None:
    table = TaskResultVersion.__table__

    assert [column.name for column in table.primary_key.columns] == ["assignment_id", "version"]
    assert table.c.result_payload.nullable is False
    assert "updated_at" not in table.columns


def test_task_template_requires_at_least_one_typed_result_field() -> None:
    with pytest.raises(ValidationError):
        TaskTemplateWrite(title="Замер бицепса", result_fields=[])

    task = TaskTemplateWrite(
        title="Замер бицепса",
        result_fields=[MeasurementResultField(unit="cm", required=True)],
    )

    assert task.result_fields[0].kind == "measurement"


def test_task_template_and_assignment_keep_immutable_json_snapshots() -> None:
    assert TaskTemplate.__table__.c.result_schema.nullable is False
    assert TaskAssignment.__table__.c.task_snapshot.nullable is False
    assert TaskAssignment.__table__.c.status.nullable is False
