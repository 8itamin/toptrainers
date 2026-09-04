from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.modules.assignments import repository
from toptrainers_api.modules.assignments.schemas import WorkoutHistoryItem, WorkoutHistoryPage


@dataclass(slots=True, frozen=True)
class HistoryCursor:
    completed_at: datetime
    assignment_id: str


class InvalidHistoryCursor(ValueError):
    pass


def encode_history_cursor(completed_at: datetime, assignment_id: str) -> str:
    payload = json.dumps(
        {"completed_at": completed_at.isoformat(), "assignment_id": assignment_id},
        separators=(",", ":"),
    ).encode("utf-8")
    return base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")


def decode_history_cursor(cursor: str) -> HistoryCursor:
    try:
        padding = "=" * (-len(cursor) % 4)
        raw = base64.urlsafe_b64decode((cursor + padding).encode("ascii"))
        payload = json.loads(raw.decode("utf-8"))
        completed_at = datetime.fromisoformat(payload["completed_at"])
        assignment_id = payload["assignment_id"]
        if completed_at.tzinfo is None:
            raise ValueError
        if not isinstance(assignment_id, str) or len(assignment_id) != 36:
            raise ValueError
    except (ValueError, KeyError, TypeError) as exc:
        raise InvalidHistoryCursor("History cursor is invalid") from exc
    return HistoryCursor(completed_at=completed_at, assignment_id=assignment_id)


def build_history_page(
    rows: list[repository.WorkoutHistoryProjection],
    *,
    limit: int,
) -> WorkoutHistoryPage:
    has_more = len(rows) > limit
    visible = rows[:limit]
    items = [
        WorkoutHistoryItem(
            assignment_id=row.assignment_id,
            relationship_id=row.relationship_id,
            trainer_id=row.trainer_id,
            client_id=row.client_id,
            workout_title=row.workout_title,
            scheduled_date=row.scheduled_date,
            started_at=row.started_at,
            completed_at=row.completed_at,
        )
        for row in visible
    ]
    next_cursor = None
    if has_more and visible:
        last = visible[-1]
        next_cursor = encode_history_cursor(last.completed_at, last.assignment_id)
    return WorkoutHistoryPage(items=items, next_cursor=next_cursor)


async def list_client_workout_history(
    session: AsyncSession,
    client_id: str,
    *,
    cursor: str | None,
    limit: int,
) -> WorkoutHistoryPage:
    decoded = decode_history_cursor(cursor) if cursor else None
    rows = await repository.list_workout_history(
        session,
        client_id=client_id,
        trainer_id=None,
        cursor_completed_at=decoded.completed_at if decoded else None,
        cursor_assignment_id=decoded.assignment_id if decoded else None,
        fetch_limit=limit + 1,
    )
    return build_history_page(rows, limit=limit)


async def list_trainer_client_workout_history(
    session: AsyncSession,
    trainer_id: str,
    client_id: str,
    *,
    cursor: str | None,
    limit: int,
) -> WorkoutHistoryPage:
    decoded = decode_history_cursor(cursor) if cursor else None
    rows = await repository.list_workout_history(
        session,
        client_id=client_id,
        trainer_id=trainer_id,
        cursor_completed_at=decoded.completed_at if decoded else None,
        cursor_assignment_id=decoded.assignment_id if decoded else None,
        fetch_limit=limit + 1,
    )
    return build_history_page(rows, limit=limit)
