from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, date, datetime

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from toptrainers_api.core.auth import current_account
from toptrainers_api.core.db import get_session
from toptrainers_api.modules.assignments import history_service
from toptrainers_api.modules.assignments import service as assignment_service
from toptrainers_api.modules.assignments.history_router import router as history_router
from toptrainers_api.modules.assignments.models import (
    WorkoutAssignment,
    WorkoutAssignmentStatus,
    WorkoutExecution,
)
from toptrainers_api.modules.clients.models import (
    InvitationStatus,
    RelationshipStatus,
    TrainerClientInvitation,
    TrainerClientRelationship,
)
from toptrainers_api.modules.identity.models import Account
from toptrainers_api.modules.workouts.models import Workout

pytestmark = pytest.mark.asyncio

T1 = "11111111-1111-1111-1111-111111111111"
T2 = "22222222-2222-2222-2222-222222222222"
C1 = "33333333-3333-3333-3333-333333333333"
C2 = "44444444-4444-4444-4444-444444444444"
NO_REL_CLIENT = "99999999-9999-9999-9999-999999999999"
R1 = "51111111-1111-1111-1111-111111111111"
R2 = "52222222-2222-2222-2222-222222222222"
R3 = "53333333-3333-3333-3333-333333333333"
R4 = "54444444-4444-4444-4444-444444444444"
W1 = "61111111-1111-1111-1111-111111111111"
W2 = "62222222-2222-2222-2222-222222222222"
A_NEW = "f0000000-0000-0000-0000-000000000001"
A_TIE = "e0000000-0000-0000-0000-000000000002"
A_OLD = "d0000000-0000-0000-0000-000000000003"
A_T2 = "c0000000-0000-0000-0000-000000000004"
A_C2 = "b0000000-0000-0000-0000-000000000005"
A_PLANNED = "a1000000-0000-0000-0000-000000000006"
A_PROGRESS = "a2000000-0000-0000-0000-000000000007"
A_CANCELLED = "a3000000-0000-0000-0000-000000000008"
A_INCOMPLETE_COMPLETION = "a4000000-0000-0000-0000-000000000009"
A_IMMEDIATE = "a5000000-0000-0000-0000-000000000010"
SCHEDULED = date(2026, 9, 4)
TIE_COMPLETED_AT = datetime(2026, 9, 4, 10, 0, tzinfo=UTC)


def snapshot(title: str) -> dict[str, object]:
    return {"title": title, "description": "frozen", "blocks": []}


def assignment(
    assignment_id: str,
    relationship_id: str,
    workout_id: str,
    status: str,
    title: str,
) -> WorkoutAssignment:
    return WorkoutAssignment(
        id=assignment_id,
        relationship_id=relationship_id,
        source_workout_id=workout_id,
        request_id=f"history-{assignment_id}",
        workout_snapshot=snapshot(title),
        snapshot_schema_version=1,
        scheduled_date=SCHEDULED,
        status=status,
    )


def execution(
    execution_id: str,
    assignment_id: str,
    completed_at: datetime | None,
) -> WorkoutExecution:
    return WorkoutExecution(
        id=execution_id,
        assignment_id=assignment_id,
        started_at=datetime(2026, 9, 4, 9, 0, tzinfo=UTC),
        completed_at=completed_at,
    )


async def seed_history_graph(factory: async_sessionmaker[AsyncSession]) -> None:
    async with factory() as session:
        session.add_all(
            [
                Account(
                    id=T1,
                    email="t1-history@example.test",
                    password_hash="test",
                    role="trainer",
                ),
                Account(
                    id=T2,
                    email="t2-history@example.test",
                    password_hash="test",
                    role="trainer",
                ),
                Account(
                    id=C1,
                    email="c1-history@example.test",
                    password_hash="test",
                    role="client",
                ),
                Account(
                    id=C2,
                    email="c2-history@example.test",
                    password_hash="test",
                    role="client",
                ),
            ]
        )
        await session.flush()

        invitations = [
            TrainerClientInvitation(
                id="71111111-1111-1111-1111-111111111111",
                trainer_id=T1,
                client_id=C1,
                status=InvitationStatus.ACCEPTED.value,
            ),
            TrainerClientInvitation(
                id="72222222-2222-2222-2222-222222222222",
                trainer_id=T1,
                client_id=C1,
                status=InvitationStatus.ACCEPTED.value,
            ),
            TrainerClientInvitation(
                id="73333333-3333-3333-3333-333333333333",
                trainer_id=T2,
                client_id=C1,
                status=InvitationStatus.ACCEPTED.value,
            ),
            TrainerClientInvitation(
                id="74444444-4444-4444-4444-444444444444",
                trainer_id=T1,
                client_id=C2,
                status=InvitationStatus.ACCEPTED.value,
            ),
        ]
        session.add_all(invitations)
        await session.flush()

        session.add_all(
            [
                TrainerClientRelationship(
                    id=R1,
                    trainer_id=T1,
                    client_id=C1,
                    invitation_id=invitations[0].id,
                    status=RelationshipStatus.TERMINATED.value,
                    terminated_at=datetime(2026, 8, 31, tzinfo=UTC),
                ),
                TrainerClientRelationship(
                    id=R2,
                    trainer_id=T1,
                    client_id=C1,
                    invitation_id=invitations[1].id,
                    status=RelationshipStatus.ACTIVE.value,
                ),
                TrainerClientRelationship(
                    id=R3,
                    trainer_id=T2,
                    client_id=C1,
                    invitation_id=invitations[2].id,
                    status=RelationshipStatus.ACTIVE.value,
                ),
                TrainerClientRelationship(
                    id=R4,
                    trainer_id=T1,
                    client_id=C2,
                    invitation_id=invitations[3].id,
                    status=RelationshipStatus.ACTIVE.value,
                ),
                Workout(id=W1, trainer_id=T1, title="CURRENT TITLE", description=""),
                Workout(id=W2, trainer_id=T2, title="T2 CURRENT TITLE", description=""),
            ]
        )
        await session.flush()

        session.add_all(
            [
                assignment(A_NEW, R2, W1, WorkoutAssignmentStatus.COMPLETED.value, "Frozen new"),
                assignment(
                    A_TIE,
                    R1,
                    W1,
                    WorkoutAssignmentStatus.COMPLETED.value,
                    "Frozen terminated",
                ),
                assignment(A_OLD, R2, W1, WorkoutAssignmentStatus.COMPLETED.value, "Frozen old"),
                assignment(A_T2, R3, W2, WorkoutAssignmentStatus.COMPLETED.value, "Other trainer"),
                assignment(A_C2, R4, W1, WorkoutAssignmentStatus.COMPLETED.value, "Other client"),
                assignment(A_PLANNED, R2, W1, WorkoutAssignmentStatus.PLANNED.value, "Planned"),
                assignment(
                    A_PROGRESS,
                    R2,
                    W1,
                    WorkoutAssignmentStatus.IN_PROGRESS.value,
                    "Progress",
                ),
                assignment(
                    A_CANCELLED,
                    R2,
                    W1,
                    WorkoutAssignmentStatus.CANCELLED.value,
                    "Cancelled",
                ),
                assignment(
                    A_INCOMPLETE_COMPLETION,
                    R2,
                    W1,
                    WorkoutAssignmentStatus.COMPLETED.value,
                    "Missing completed_at",
                ),
            ]
        )
        await session.flush()

        session.add_all(
            [
                execution("81111111-1111-1111-1111-111111111111", A_NEW, TIE_COMPLETED_AT),
                execution("82222222-2222-2222-2222-222222222222", A_TIE, TIE_COMPLETED_AT),
                execution(
                    "83333333-3333-3333-3333-333333333333",
                    A_OLD,
                    datetime(2026, 9, 3, 10, 0, tzinfo=UTC),
                ),
                execution(
                    "84444444-4444-4444-4444-444444444444",
                    A_T2,
                    datetime(2026, 9, 2, 10, 0, tzinfo=UTC),
                ),
                execution(
                    "85555555-5555-5555-5555-555555555555",
                    A_C2,
                    datetime(2026, 9, 1, 10, 0, tzinfo=UTC),
                ),
                execution("86666666-6666-6666-6666-666666666666", A_PROGRESS, None),
                execution("87777777-7777-7777-7777-777777777777", A_INCOMPLETE_COMPLETION, None),
            ]
        )
        await session.commit()


@asynccontextmanager
async def history_http_client(
    factory: async_sessionmaker[AsyncSession],
    actor_id: str,
    role: str,
) -> AsyncIterator[AsyncClient]:
    app = FastAPI()
    app.include_router(history_router)

    async def override_current_account() -> dict[str, object]:
        return {"sub": actor_id, "role": role, "sid": "history-test"}

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session

    app.dependency_overrides[current_account] = override_current_account
    app.dependency_overrides[get_session] = override_session
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        yield client


async def test_client_history_aggregates_relationships_and_is_self_scoped(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_history_graph(p0_session_factory)
    async with history_http_client(p0_session_factory, C1, "client") as client:
        response = await client.get("/workout-history?limit=20")
    assert response.status_code == 200
    items = response.json()["items"]
    ids = [item["assignment_id"] for item in items]
    assert ids == [A_NEW, A_TIE, A_OLD, A_T2]
    assert {item["relationship_id"] for item in items} >= {R1, R2}
    assert A_C2 not in ids
    assert A_PLANNED not in ids
    assert A_PROGRESS not in ids
    assert A_CANCELLED not in ids
    assert A_INCOMPLETE_COMPLETION not in ids
    assert items[0]["workout_title"] == "Frozen new"
    assert "workout_snapshot" not in items[0]


async def test_trainer_history_is_pair_scoped_and_empty_pair_is_success(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_history_graph(p0_session_factory)
    async with history_http_client(p0_session_factory, T1, "trainer") as client:
        response = await client.get(f"/clients/{C1}/workout-history")
        empty = await client.get(f"/clients/{NO_REL_CLIENT}/workout-history")
    assert response.status_code == 200
    ids = [item["assignment_id"] for item in response.json()["items"]]
    assert ids == [A_NEW, A_TIE, A_OLD]
    assert A_T2 not in ids
    assert empty.status_code == 200
    assert empty.json() == {"items": [], "next_cursor": None}


async def test_cursor_boundary_is_deterministic_without_duplicate_or_skip(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_history_graph(p0_session_factory)
    async with history_http_client(p0_session_factory, T1, "trainer") as client:
        page1 = await client.get(f"/clients/{C1}/workout-history?limit=2")
        cursor = page1.json()["next_cursor"]
        assert cursor is not None
        page2 = await client.get(
            f"/clients/{C1}/workout-history",
            params={"limit": 2, "cursor": cursor},
        )
    ids1 = [item["assignment_id"] for item in page1.json()["items"]]
    ids2 = [item["assignment_id"] for item in page2.json()["items"]]
    assert ids1 == [A_NEW, A_TIE]
    assert ids2 == [A_OLD]
    assert set(ids1).isdisjoint(ids2)
    assert ids1 + ids2 == [A_NEW, A_TIE, A_OLD]
    assert page2.json()["next_cursor"] is None


async def test_history_title_comes_from_frozen_snapshot_not_current_workout(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_history_graph(p0_session_factory)
    async with p0_session_factory() as session:
        workout = await session.get(Workout, W1)
        assert workout is not None
        workout.title = "MUTATED CURRENT TEMPLATE"
        await session.commit()
    async with p0_session_factory() as session:
        page = await history_service.list_trainer_client_workout_history(
            session,
            T1,
            C1,
            cursor=None,
            limit=20,
        )
    assert page.items[0].workout_title == "Frozen new"
    assert all(item.workout_title != "MUTATED CURRENT TEMPLATE" for item in page.items)


async def test_completion_is_visible_immediately_after_committed_complete(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await seed_history_graph(p0_session_factory)
    async with p0_session_factory() as session:
        session.add(
            assignment(
                A_IMMEDIATE,
                R2,
                W1,
                WorkoutAssignmentStatus.PLANNED.value,
                "Immediate completion",
            )
        )
        await session.commit()

    async with p0_session_factory() as session:
        await assignment_service.start_execution(session, C1, A_IMMEDIATE)
        completed = await assignment_service.complete_execution(session, C1, A_IMMEDIATE)
        assert completed.completed_at is not None

    async with p0_session_factory() as session:
        page = await history_service.list_client_workout_history(
            session,
            C1,
            cursor=None,
            limit=20,
        )
    immediate = next(item for item in page.items if item.assignment_id == A_IMMEDIATE)
    assert immediate.completed_at == completed.completed_at
    assert immediate.workout_title == "Immediate completion"
