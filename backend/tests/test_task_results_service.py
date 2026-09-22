from __future__ import annotations

import pytest
from fastapi import HTTPException

from toptrainers_api.modules.tasks.models import TaskAssignment
from toptrainers_api.modules.tasks.schemas import SubmitTaskResultRequest
from toptrainers_api.modules.tasks.service import _result_payload


def _assignment(fields: list[dict[str, object]]) -> TaskAssignment:
    return TaskAssignment(
        id="a" * 36,
        relationship_id="r" * 36,
        source_task_template_id="t" * 36,
        scheduled_date="2026-10-01",  # type: ignore[arg-type]
        task_snapshot={"result_schema": {"fields": fields}},
        status="PENDING",
    )


def test_result_rejects_unconfigured_field() -> None:
    assignment = _assignment([{"kind": "measurement", "unit": "cm", "required": True}])

    with pytest.raises(HTTPException, match="not enabled"):
        _result_payload(
            assignment,
            SubmitTaskResultRequest(request_id="r1", note="готово"),
        )


def test_result_requires_configured_required_field() -> None:
    assignment = _assignment(
        [
            {"kind": "measurement", "unit": "cm", "required": True},
            {"kind": "completion", "required": False},
        ]
    )

    with pytest.raises(HTTPException, match="missing"):
        _result_payload(
            assignment,
            SubmitTaskResultRequest(request_id="r1", completed=True),
        )


def test_result_payload_keeps_typed_values_and_photo_identifiers() -> None:
    assignment = _assignment(
        [
            {"kind": "measurement", "unit": "cm", "required": True},
            {"kind": "photo", "required": False},
        ]
    )

    result = _result_payload(
        assignment,
        SubmitTaskResultRequest(
            request_id="r1",
            measurement_value=37.5,
            photo_media_ids=["m" * 36],
        ),
    )

    assert result["measurement_value"] == 37.5
    assert result["photo_media_ids"] == ["m" * 36]
