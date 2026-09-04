from __future__ import annotations

from datetime import UTC, date, datetime

import pytest
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateIndex

from toptrainers_api.modules.assignments import history_service, repository
from toptrainers_api.modules.assignments.models import WorkoutExecution


def projection(
    assignment_id: str,
    completed_at: datetime,
) -> repository.WorkoutHistoryProjection:
    return repository.WorkoutHistoryProjection(
        assignment_id=assignment_id,
        relationship_id="44444444-4444-4444-4444-444444444444",
        trainer_id="11111111-1111-1111-1111-111111111111",
        client_id="22222222-2222-2222-2222-222222222222",
        workout_title="Frozen title",
        scheduled_date=date(2026, 9, 4),
        started_at=datetime(2026, 9, 4, 9, 0, tzinfo=UTC),
        completed_at=completed_at,
    )


def test_history_query_uses_frozen_snapshot_and_pair_scope() -> None:
    query = repository.workout_history_query(
        client_id="22222222-2222-2222-2222-222222222222",
        trainer_id="11111111-1111-1111-1111-111111111111",
        cursor_completed_at=None,
        cursor_assignment_id=None,
        fetch_limit=21,
    )
    sql = str(
        query.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )
    normalized = " ".join(sql.split()).lower()
    assert "trainer_client_relationships join workout_assignments" in normalized
    assert "join workout_executions" in normalized
    assert "workout_assignments.workout_snapshot ->> 'title'" in normalized
    assert "join workouts" not in normalized
    assert "workout_assignments.status = 'completed'" in normalized
    assert "workout_executions.completed_at is not null" in normalized
    assert "trainer_client_relationships.status" not in normalized
    assert "trainer_client_relationships.trainer_id =" in normalized
    assert "trainer_client_relationships.client_id =" in normalized
    assert "limit 21" in normalized


def test_history_cursor_roundtrip_and_limit_plus_one_page() -> None:
    completed_at = datetime(2026, 9, 4, 10, 0, tzinfo=UTC)
    first_id = "ffffffff-ffff-ffff-ffff-ffffffffffff"
    second_id = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
    cursor = history_service.encode_history_cursor(completed_at, first_id)
    decoded = history_service.decode_history_cursor(cursor)
    assert decoded.completed_at == completed_at
    assert decoded.assignment_id == first_id

    page = history_service.build_history_page(
        [projection(first_id, completed_at), projection(second_id, completed_at)],
        limit=1,
    )
    assert [item.assignment_id for item in page.items] == [first_id]
    assert page.next_cursor is not None
    assert history_service.decode_history_cursor(page.next_cursor).assignment_id == first_id


@pytest.mark.parametrize("cursor", ["not-base64!", "", "e30"])
def test_invalid_history_cursor_is_rejected(cursor: str) -> None:
    with pytest.raises(history_service.InvalidHistoryCursor):
        history_service.decode_history_cursor(cursor)


def test_history_partial_index_matches_required_order() -> None:
    index = next(
        index
        for index in WorkoutExecution.__table__.indexes
        if index.name == "ix_workout_executions_history_completed"
    )
    ddl = str(CreateIndex(index).compile(dialect=postgresql.dialect()))
    assert ddl == (
        "CREATE INDEX ix_workout_executions_history_completed "
        "ON workout_executions (completed_at DESC, assignment_id DESC) "
        "WHERE completed_at IS NOT NULL"
    )
