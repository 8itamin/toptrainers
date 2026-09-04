from __future__ import annotations

from decimal import Decimal

import pytest
from pydantic import ValidationError
from sqlalchemy import CheckConstraint

from toptrainers_api.core.db import Base
from toptrainers_api.modules.assignments import schemas


def test_results_table_uses_only_execution_and_frozen_coordinates_as_identity() -> None:
    table = Base.metadata.tables.get("workout_execution_set_results")
    assert table is not None
    assert [column.name for column in table.primary_key.columns] == [
        "execution_id",
        "block_position",
        "exercise_position",
        "set_index",
    ]
    assert "source_exercise_id" not in table.columns
    assert set(table.columns.keys()) == {
        "execution_id",
        "block_position",
        "exercise_position",
        "set_index",
        "actual_reps",
        "actual_weight_kg",
    }

    checks = {
        str(constraint.sqltext)
        for constraint in table.constraints
        if isinstance(constraint, CheckConstraint)
    }
    assert any("block_position >= 0" in check for check in checks)
    assert any("exercise_position >= 0" in check for check in checks)
    assert any("set_index >= 0" in check for check in checks)
    assert any("actual_reps" in check and "1000" in check for check in checks)
    assert any("actual_weight_kg" in check and "1000" in check for check in checks)
    assert any(
        "actual_reps IS NOT NULL" in check and "actual_weight_kg IS NOT NULL" in check
        for check in checks
    )


def test_result_upsert_request_requires_at_least_one_actual_and_accepts_zero_reps() -> None:
    request_class = getattr(schemas, "WorkoutExecutionSetResultUpsertRequest", None)
    assert request_class is not None

    with pytest.raises(ValidationError):
        request_class(actual_reps=None, actual_weight_kg=None)

    reps_only = request_class(actual_reps=0)
    assert reps_only.actual_reps == 0
    assert reps_only.actual_weight_kg is None

    weight_only = request_class(actual_weight_kg=42.5)
    assert weight_only.actual_reps is None
    assert Decimal(str(weight_only.actual_weight_kg)) == Decimal("42.5")

    with pytest.raises(ValidationError):
        request_class(actual_reps=1001)
    with pytest.raises(ValidationError):
        request_class(actual_weight_kg=1000.01)


def test_result_response_has_no_source_exercise_identity() -> None:
    response_class = getattr(schemas, "WorkoutExecutionSetResultResponse", None)
    assert response_class is not None
    assert set(response_class.model_fields) == {
        "execution_id",
        "block_position",
        "exercise_position",
        "set_index",
        "actual_reps",
        "actual_weight_kg",
    }
