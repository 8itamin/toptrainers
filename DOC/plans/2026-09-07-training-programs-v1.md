# Training Programs v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the existing mutable Trainer Program into a reusable multi-week schedule that can be atomically issued to a Client as immutable `ProgramAssignment` plus ordinary frozen `WorkoutAssignment` children without changing the existing `Assignment → Execution → Results → History` lifecycle.

**Architecture:** `programs` owns mutable Program metadata/schedule and ProgramAssignment orchestration. Issuance freezes Program metadata/schedule/Workout IDs in `ProgramAssignment.program_snapshot`, then calls a shared commit-free `assignments.service.materialize_assignment()` for every slot and commits exactly once. Child `WorkoutAssignment` remains lifecycle authority; Program cancellation only cancels children that are still `PLANNED`, and Program/child races preserve the existing Account/Relationship lock order plus Program/ProgramAssignment locks.

**Tech Stack:** Python 3.13, FastAPI, SQLAlchemy 2 async, PostgreSQL 17, Alembic, PostgreSQL JSONB, Pydantic v2, pytest/pytest-asyncio, Ruff, mypy, Angular/Nx regression gates, FastAPI-generated OpenAPI.

**Spec:** `DOC/specs/2026-09-06-training-programs-v1-design.md`

## Global Constraints

- Implementation baseline: `main@9c751bc4628c198e84e0a73d5c1b9915a30c08df` unless `main` advances before execution. If it advances, branch/rebase from the new `main` and re-run all regression gates before publication.
- Design baseline: `design/training-programs-v1@ded75199e3ab33179e24be12135cea084585d51a`.
- Migration: `20260906_0010_training_programs_v1`, additive, `down_revision = 20260904_0009`.
- Existing physical `programs.weeks` remains. Public Program field is only `duration_weeks`.
- `duration_weeks: 1..52`; `week_number >= 1`; `day_number: 1..7`; maximum one slot per `(program_id, week_number, day_number)`.
- `start_date` is day 1 of week 1 and need not be Monday. Child date = `start_date + (week_number-1)*7 + (day_number-1)` days.
- Mutable Program command/response slots expose only `week_number`, `day_number`, `workout_id`. Live `ProgramSlot.id` is internal and not stable public identity.
- Mutable Program schedule responses, Program snapshots and ProgramAssignment child summaries are deterministically ordered by `(week_number ASC, day_number ASC)`.
- Empty Program may be saved. Empty Program issuance returns `409 PROGRAM_EMPTY`.
- Foreign/nonexistent Workout is hidden as `404 PROGRAM_WORKOUT_NOT_FOUND` during Program create/replace.
- Stale/unavailable Workout during issuance returns `409 PROGRAM_NOT_ASSIGNABLE`; no partial parent/child rows survive.
- `ProgramAssignment.program_snapshot` contains Program metadata, schedule coordinates, copied live slot IDs and Workout IDs only; never Workout content.
- Child `WorkoutAssignment.workout_snapshot` remains authoritative frozen Workout content.
- Child provenance is nullable `program_assignment_id` FK plus nullable immutable copied `program_slot_id` string without FK to live `program_slots`; both are NULL or both are non-NULL.
- Direct Assignment provenance remains NULL/NULL and existing HTTP semantics remain unchanged.
- Parent idempotency key is `(relationship_id, request_id)`. Retry equality uses only `source_program_id + start_date`, never current Program/Workout state.
- Issuance has exactly one final commit. Shared Assignment materializer MUST NOT commit or rollback.
- Program Edit vs Assign serializes on Program row lock; result is complete old schedule or complete new schedule, never mixed.
- Program cancellation vs child Start serializes through Client Account → Relationship before ProgramAssignment/Assignment locks.
- Program cancellation cancels only `PLANNED` children. `IN_PROGRESS`, `COMPLETED`, Execution, Results and History remain untouched.
- Relationship termination remains Program-agnostic and relies on ordinary child Assignments.
- No Program Sync, lazy issuance, background scheduler, parent auto-complete, parent/child status synchronization, whole-program reschedule, recurrence engine, analytics/adherence or frontend UI in v1.
- Backend modules MUST NOT import another module's repository directly. Cross-module access uses public service contracts.
- FastAPI-generated OpenAPI is authoritative. Never hand-edit `backend/openapi/openapi.json`.
- Do not modify `arc/`.

---

## File Map

### `programs` module

- `models.py` — Program, ProgramSlot, ProgramAssignment persistence models.
- `schemas.py` — public Program DTOs, Program snapshot v1 DTOs, ProgramAssignment DTOs.
- `repository.py` — SQL only for Program, ProgramSlot and ProgramAssignment aggregate-owned rows.
- `service.py` — Program CRUD, schedule validation/replacement, parent idempotency, issuance orchestration, parent read/cancel.
- `router.py` — Program and ProgramAssignment HTTP endpoints.

### `assignments` module

- `models.py` — add nullable Program provenance to WorkoutAssignment.
- `repository.py` — add child read/lock queries by `program_assignment_id`.
- `service.py` — shared commit-free materializer plus public child-list/lock/cancel service contracts.

### `workouts` module

- `repository.py` — add batch owned-Workout query.
- `service.py` — expose batch public `get_owned_workouts()` contract to prevent N+1 validation for up to 364 Program slots.

### Migration and docs

- `backend/migrations/versions/20260906_0010_training_programs_v1.py`
- generated `backend/openapi/openapi.json`
- completion checkpoint in `DOC/PROJECT_MEMORY.md`
- ADR-015/ADR-016 already recorded in design branch.

---

### Task 1: Add Program v1 persistence and migration contract

**Files:**
- Modify: `backend/src/toptrainers_api/modules/programs/models.py`
- Modify: `backend/src/toptrainers_api/modules/assignments/models.py`
- Create: `backend/migrations/versions/20260906_0010_training_programs_v1.py`
- Create: `backend/tests/test_training_programs_model_contract.py`
- Create: `backend/tests/test_training_programs_migration.py`
- Modify: `backend/tests/test_p0_alembic_roundtrip.py`

**Interfaces:**
- Produces ORM `ProgramSlot`, `ProgramAssignment`, `ProgramAssignmentStatus`.
- Extends `WorkoutAssignment` with `program_assignment_id: str | None` and `program_slot_id: str | None`.
- Physical `Program.weeks` remains unchanged.
- Alembic head becomes `20260906_0010`.

- [ ] **Step 1: Write failing ORM contract tests**

Add imports for `CheckConstraint`, `UniqueConstraint`, then assert the exact schema:

```python
def test_program_slot_contract() -> None:
    table = ProgramSlot.__table__
    assert table.c.id.primary_key is True
    assert table.c.program_id.nullable is False
    assert table.c.workout_id.nullable is False
    assert table.c.week_number.nullable is False
    assert table.c.day_number.nullable is False
    assert {fk.target_fullname for fk in table.c.program_id.foreign_keys} == {"programs.id"}
    assert {fk.target_fullname for fk in table.c.workout_id.foreign_keys} == {"workouts.id"}
    uniques = {
        tuple(column.name for column in constraint.columns)
        for constraint in table.constraints
        if isinstance(constraint, UniqueConstraint)
    }
    assert ("program_id", "week_number", "day_number") in uniques


def test_program_assignment_contract() -> None:
    table = ProgramAssignment.__table__
    assert table.c.id.primary_key is True
    assert table.c.relationship_id.nullable is False
    assert table.c.source_program_id.nullable is False
    assert table.c.request_id.nullable is False
    assert table.c.start_date.nullable is False
    assert table.c.program_snapshot.nullable is False
    assert table.c.snapshot_schema_version.nullable is False
    assert table.c.status.nullable is False
    assert table.c.cancelled_at.nullable is True
    uniques = {
        tuple(column.name for column in constraint.columns)
        for constraint in table.constraints
        if isinstance(constraint, UniqueConstraint)
    }
    assert ("relationship_id", "request_id") in uniques


def test_workout_assignment_program_provenance_is_nullable_pair() -> None:
    table = WorkoutAssignment.__table__
    assert table.c.program_assignment_id.nullable is True
    assert table.c.program_slot_id.nullable is True
    assert {fk.target_fullname for fk in table.c.program_assignment_id.foreign_keys} == {
        "program_assignments.id"
    }
    assert not table.c.program_slot_id.foreign_keys
```

Also assert the named check constraints listed in Step 3.

- [ ] **Step 2: Run ORM RED**

```bash
pytest backend/tests/test_training_programs_model_contract.py -q
```

Expected: import/attribute failures because ProgramSlot/ProgramAssignment/provenance do not exist.

- [ ] **Step 3: Implement exact ORM models**

Replace `programs/models.py` imports with the required SQLAlchemy types and add these model definitions while retaining `Program.weeks`:

```python
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func


class ProgramAssignmentStatus(StrEnum):
    ACTIVE = "ACTIVE"
    CANCELLED = "CANCELLED"


class ProgramSlot(Base):
    __tablename__ = "program_slots"
    __table_args__ = (
        UniqueConstraint(
            "program_id",
            "week_number",
            "day_number",
            name="uq_program_slots_program_week_day",
        ),
        CheckConstraint("week_number >= 1", name="ck_program_slots_week_number"),
        CheckConstraint(
            "day_number >= 1 AND day_number <= 7",
            name="ck_program_slots_day_number",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    program_id: Mapped[str] = mapped_column(ForeignKey("programs.id"), nullable=False, index=True)
    week_number: Mapped[int] = mapped_column(Integer, nullable=False)
    day_number: Mapped[int] = mapped_column(Integer, nullable=False)
    workout_id: Mapped[str] = mapped_column(ForeignKey("workouts.id"), nullable=False)


class ProgramAssignment(Base):
    __tablename__ = "program_assignments"
    __table_args__ = (
        UniqueConstraint(
            "relationship_id",
            "request_id",
            name="uq_program_assignments_relationship_request_id",
        ),
        CheckConstraint(
            "snapshot_schema_version = 1",
            name="ck_program_assignments_snapshot_schema_version",
        ),
        CheckConstraint(
            "status IN ('ACTIVE', 'CANCELLED')",
            name="ck_program_assignments_status",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    relationship_id: Mapped[str] = mapped_column(
        ForeignKey("trainer_client_relationships.id"), nullable=False, index=True
    )
    source_program_id: Mapped[str] = mapped_column(ForeignKey("programs.id"), nullable=False)
    request_id: Mapped[str] = mapped_column(String(128), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    program_snapshot: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    snapshot_schema_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

In `WorkoutAssignment.__table_args__`, add:

```python
CheckConstraint(
    "((program_assignment_id IS NULL AND program_slot_id IS NULL) OR "
    "(program_assignment_id IS NOT NULL AND program_slot_id IS NOT NULL))",
    name="ck_workout_assignments_program_provenance_pair",
),
Index("ix_workout_assignments_program_assignment_id", "program_assignment_id"),
```

and fields:

```python
program_assignment_id: Mapped[str | None] = mapped_column(
    ForeignKey("program_assignments.id"), nullable=True
)
program_slot_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
```

- [ ] **Step 4: Write migration RED tests**

Test:

```text
0009 → 0010
program_slots exists with unique/check/FKs
program_assignments exists with unique/check/FKs
workout_assignments provenance columns are nullable
existing direct WorkoutAssignment survives with NULL/NULL provenance
0010 → 0009 in isolated dev test removes only new schema
0009 → 0010 again succeeds
```

Update canonical Alembic-head assertions from `20260904_0009` to `20260906_0010`.

- [ ] **Step 5: Run migration RED**

```bash
pytest backend/tests/test_training_programs_migration.py backend/tests/test_p0_alembic_roundtrip.py -q
```

Expected: missing revision/head failures.

- [ ] **Step 6: Implement additive migration**

Create `20260906_0010_training_programs_v1.py` with the exact schema from Step 3. `upgrade()` creates parent tables first, then adds nullable child provenance. `downgrade()` drops the provenance index/constraint/columns, then `program_assignments`, then `program_slots`. No data backfill.

- [ ] **Step 7: Run Task 1 GREEN**

```bash
pytest backend/tests/test_training_programs_model_contract.py \
       backend/tests/test_training_programs_migration.py \
       backend/tests/test_p0_alembic_roundtrip.py -q
```

Expected: PASS on PostgreSQL.

- [ ] **Step 8: Commit Task 1**

```bash
git add backend/src/toptrainers_api/modules/programs/models.py \
        backend/src/toptrainers_api/modules/assignments/models.py \
        backend/migrations/versions/20260906_0010_training_programs_v1.py \
        backend/tests/test_training_programs_model_contract.py \
        backend/tests/test_training_programs_migration.py \
        backend/tests/test_p0_alembic_roundtrip.py
git commit -m "feat: add training program persistence"
```

---

### Task 2: Add batch Workout ownership contract and mutable Program schedule CRUD

**Files:**
- Modify: `backend/src/toptrainers_api/modules/workouts/repository.py`
- Modify: `backend/src/toptrainers_api/modules/workouts/service.py`
- Modify: `backend/src/toptrainers_api/modules/programs/schemas.py`
- Create: `backend/src/toptrainers_api/modules/programs/repository.py`
- Create: `backend/src/toptrainers_api/modules/programs/service.py`
- Modify: `backend/src/toptrainers_api/modules/programs/router.py`
- Create: `backend/tests/test_workouts_batch_contract.py`
- Create: `backend/tests/test_training_programs_domain.py`
- Create: `backend/tests/test_training_programs_http_contract.py`

**Interfaces:**
- Produces `workouts.service.get_owned_workouts(session, trainer_id, workout_ids) -> list[Workout]`.
- Produces Program DTOs `ProgramSlotCommand`, `ProgramCreateRequest`, `ProgramReplaceRequest`, `ProgramSlotResponse`, `ProgramResponse`.
- Produces Program service functions `list_programs`, `get_program`, `create_program`, `replace_program`.

- [ ] **Step 1: Write batch Workout RED test**

```python
async def test_get_owned_workouts_returns_only_requested_owned_rows(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    # seed trainer A workouts a1/a2 and trainer B workout b1
    async with p0_session_factory() as session:
        rows = await workouts_service.get_owned_workouts(
            session,
            "trainer-a",
            {"a1", "a2", "b1", "missing"},
        )
    assert {row.id for row in rows} == {"a1", "a2"}
```

- [ ] **Step 2: Run batch RED**

```bash
pytest backend/tests/test_workouts_batch_contract.py -q
```

Expected: `get_owned_workouts` missing.

- [ ] **Step 3: Implement batch Workout query/service**

Add repository function:

```python
async def list_owned_by_ids(
    session: AsyncSession,
    trainer_id: str,
    workout_ids: set[str],
) -> list[Workout]:
    if not workout_ids:
        return []
    rows = await session.scalars(
        select(Workout)
        .where(Workout.trainer_id == trainer_id, Workout.id.in_(workout_ids))
        .options(selectinload(Workout.blocks).selectinload(WorkoutBlock.items))
        .order_by(Workout.id)
    )
    return list(rows.unique().all())
```

Expose from service:

```python
async def get_owned_workouts(
    session: AsyncSession,
    trainer_id: str,
    workout_ids: set[str],
) -> list[Workout]:
    return await repository.list_owned_by_ids(session, trainer_id, workout_ids)
```

- [ ] **Step 4: Write Program DTO/domain RED tests**

Define the intended public contract in tests:

```python
def test_program_response_uses_duration_weeks_only() -> None:
    response = ProgramResponse(
        id="program-id",
        trainer_id="trainer-id",
        title="Base",
        description="",
        duration_weeks=4,
        slots=[],
    )
    payload = response.model_dump()
    assert payload["duration_weeks"] == 4
    assert "weeks" not in payload


def test_empty_program_command_is_valid() -> None:
    payload = ProgramCreateRequest(
        title="Base",
        description="",
        duration_weeks=4,
        slots=[],
    )
    assert payload.slots == []
```

Add integration cases:

```text
empty Program saves
duplicate week/day → 409 PROGRAM_SLOT_DUPLICATE
slot beyond duration → 409 PROGRAM_SLOT_OUTSIDE_DURATION
foreign/nonexistent Workout → 404 PROGRAM_WORKOUT_NOT_FOUND
PUT replaces metadata and complete schedule
failed PUT preserves old metadata/schedule
Program response slots sorted week/day
client role cannot read/mutate Trainer Programs
```

- [ ] **Step 5: Run Program RED**

```bash
pytest backend/tests/test_training_programs_domain.py backend/tests/test_training_programs_http_contract.py -q
```

Expected: new Program schemas/service/repository/endpoints missing.

- [ ] **Step 6: Implement exact Program schemas**

```python
class ProgramSlotCommand(BaseModel):
    week_number: int = Field(ge=1)
    day_number: int = Field(ge=1, le=7)
    workout_id: str = Field(min_length=1, max_length=36)


class ProgramCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=2_000)
    duration_weeks: int = Field(default=1, ge=1, le=52)
    slots: list[ProgramSlotCommand] = Field(default_factory=list)


class ProgramReplaceRequest(ProgramCreateRequest):
    pass


class ProgramSlotResponse(ProgramSlotCommand):
    pass


class ProgramResponse(BaseModel):
    id: str
    trainer_id: str
    title: str
    description: str
    duration_weeks: int
    slots: list[ProgramSlotResponse]
```

Do not expose live slot IDs.

- [ ] **Step 7: Implement Program repository**

Repository owns only Program/ProgramSlot SQL. Required functions:

```text
list_for_trainer ordered by Program.id
get_for_trainer with slots ordered week/day
lock_for_trainer FOR UPDATE
list_slots ordered week/day
replace_slots inside caller-owned transaction
```

`replace_slots()` deletes current ProgramSlot rows for the Program, adds the already validated replacement rows, and performs `flush()` only; no commit/rollback.

- [ ] **Step 8: Implement Program service validation/transactions**

Add a pure validator that builds coordinate set and raises:

```text
duplicate coordinate → BusinessRuleError(409, PROGRAM_SLOT_DUPLICATE)
week_number > duration_weeks → BusinessRuleError(409, PROGRAM_SLOT_OUTSIDE_DURATION)
```

Batch-validate Workout ownership once:

```text
requested workout IDs
→ workouts_service.get_owned_workouts(...)
→ returned ID set must equal requested ID set
→ otherwise 404 PROGRAM_WORKOUT_NOT_FOUND
```

Create commits once after Program + slots are added.

Replace does:

```text
owned Program FOR UPDATE
→ validate complete incoming payload
→ batch validate all Workout ownership
→ mutate title/description/weeks
→ full slot replacement
→ commit once
```

- [ ] **Step 9: Implement Program HTTP surface**

Exact operations:

```text
GET  /api/v1/programs                       operationId=listTrainingPrograms
POST /api/v1/programs                       operationId=createTrainingProgram
GET  /api/v1/programs/{program_id}          operationId=getTrainingProgram
PUT  /api/v1/programs/{program_id}          operationId=replaceTrainingProgram
```

Use existing `BusinessRuleError` and `as_http_exception` pattern. Require Trainer role for all Program endpoints in v1.

- [ ] **Step 10: Run Task 2 GREEN**

```bash
pytest backend/tests/test_workouts_batch_contract.py \
       backend/tests/test_training_programs_domain.py \
       backend/tests/test_training_programs_http_contract.py -q
```

Expected: PASS.

- [ ] **Step 11: Commit Task 2**

```bash
git add backend/src/toptrainers_api/modules/workouts/repository.py \
        backend/src/toptrainers_api/modules/workouts/service.py \
        backend/src/toptrainers_api/modules/programs \
        backend/tests/test_workouts_batch_contract.py \
        backend/tests/test_training_programs_domain.py \
        backend/tests/test_training_programs_http_contract.py
git commit -m "feat: add mutable training program schedules"
```

---

### Task 3: Extract shared commit-free WorkoutAssignment materializer and child service contracts

**Files:**
- Modify: `backend/src/toptrainers_api/modules/assignments/repository.py`
- Modify: `backend/src/toptrainers_api/modules/assignments/service.py`
- Create: `backend/tests/test_assignment_materializer.py`
- Modify: `backend/tests/test_assignments_integration.py`
- Modify: `backend/tests/test_assignments_http_contract.py`

**Interfaces:**
- Exact materializer signature:
  `materialize_assignment(session: AsyncSession, *, relationship: TrainerClientRelationship, trainer_id: str, workout_id: str, scheduled_date: date, request_id: str, program_assignment_id: str | None = None, program_slot_id: str | None = None) -> WorkoutAssignment`.
- Read children: `list_program_children(session: AsyncSession, program_assignment_id: str) -> list[WorkoutAssignment]`.
- Lock children: `lock_program_children(session: AsyncSession, program_assignment_id: str) -> list[WorkoutAssignment]`.
- Mutate already locked children: `cancel_planned_locked_assignments(assignments: list[WorkoutAssignment]) -> None`.
- None of these public cross-module service functions commits or rolls back.

- [ ] **Step 1: Write materializer RED tests**

Required assertions:

```text
creates PLANNED WorkoutAssignment
builds existing WorkoutSnapshotV1 from current owned Workout/Exercises
stores NULL/NULL provenance by default
stores provided parent/slot provenance exactly
caller rollback removes the materialized row, proving no internal commit
foreign/missing Workout preserves current WORKOUT_NOT_FOUND behavior
```

- [ ] **Step 2: Run RED**

```bash
pytest backend/tests/test_assignment_materializer.py -q
```

Expected: materializer/public child service functions absent.

- [ ] **Step 3: Implement `materialize_assignment()` by extracting existing create logic**

Move from `create_assignment()` only these responsibilities:

```text
get owned Workout through workouts_service.get_owned_workout
collect referenced Exercise IDs
get owned Exercises
build_workout_snapshot_v1
construct WorkoutAssignment with PLANNED status and optional provenance
session.add
session.flush
return assignment
```

The materializer never checks direct request-id idempotency and never commits/rolls back.

- [ ] **Step 4: Refactor Direct Assignment through materializer**

Preserve current Direct flow:

```text
Client Account → ACTIVE Relationship
→ direct request_id lookup/conflict comparison
→ materialize_assignment(..., program_assignment_id=None, program_slot_id=None)
→ existing direct service commit
```

No change to Direct HTTP response or error codes.

- [ ] **Step 5: Implement child list/lock/cancel services**

Repository:

```python
async def list_by_program_assignment(
    session: AsyncSession,
    program_assignment_id: str,
) -> list[WorkoutAssignment]:
    rows = await session.scalars(
        select(WorkoutAssignment)
        .where(WorkoutAssignment.program_assignment_id == program_assignment_id)
        .order_by(WorkoutAssignment.id)
    )
    return list(rows)


async def lock_by_program_assignment(
    session: AsyncSession,
    program_assignment_id: str,
) -> list[WorkoutAssignment]:
    rows = await session.scalars(
        select(WorkoutAssignment)
        .where(WorkoutAssignment.program_assignment_id == program_assignment_id)
        .order_by(WorkoutAssignment.id)
        .with_for_update()
    )
    return list(rows)
```

Service wrappers call those repository functions. `cancel_planned_locked_assignments()` sets `status=CANCELLED` only for rows whose current status is `PLANNED`.

- [ ] **Step 6: Run Direct regression GREEN**

```bash
pytest backend/tests/test_assignment_materializer.py \
       backend/tests/test_assignments_integration.py \
       backend/tests/test_assignments_http_contract.py -q
```

Expected: PASS, Direct provenance NULL/NULL, Direct idempotency unchanged.

- [ ] **Step 7: Commit Task 3**

```bash
git add backend/src/toptrainers_api/modules/assignments/repository.py \
        backend/src/toptrainers_api/modules/assignments/service.py \
        backend/tests/test_assignment_materializer.py \
        backend/tests/test_assignments_integration.py \
        backend/tests/test_assignments_http_contract.py
git commit -m "refactor: extract assignment materializer"
```

---

### Task 4: Add ProgramAssignment snapshot, DTO and parent repository contracts

**Files:**
- Modify: `backend/src/toptrainers_api/modules/programs/schemas.py`
- Modify: `backend/src/toptrainers_api/modules/programs/repository.py`
- Modify: `backend/src/toptrainers_api/modules/programs/service.py`
- Create: `backend/tests/test_program_assignment_domain.py`

**Interfaces:**
- Produces `ProgramSnapshotSlotV1`, `ProgramSnapshotV1`, `CreateProgramAssignmentRequest`, `ProgramAssignmentChildResponse`, `ProgramAssignmentResponse`.
- Repository functions: `get_assignment_by_request_id`, `get_program_assignment`, `lock_program_assignment`, `get_program_assignment_relationship_id`.
- Pure helper `program_assignment_command_matches(existing, source_program_id, start_date) -> bool`.

- [ ] **Step 1: Write RED snapshot/schema tests**

Assert:

```text
ProgramSnapshotV1 contains title/description/duration_weeks/slots
ProgramSnapshotSlotV1 contains slot_id/week_number/day_number/workout_id only
Workout title/blocks/exercises are absent from Program snapshot
snapshot slots are week/day ordered
CreateProgramAssignmentRequest contains client_id/start_date/request_id
child summary contains assignment_id/program_slot_id/scheduled_date/status
```

- [ ] **Step 2: Run RED**

```bash
pytest backend/tests/test_program_assignment_domain.py -q
```

Expected: ProgramAssignment schemas/helpers absent.

- [ ] **Step 3: Implement exact ProgramAssignment schemas**

```python
class ProgramSnapshotSlotV1(BaseModel):
    slot_id: str
    week_number: int
    day_number: int
    workout_id: str


class ProgramSnapshotV1(BaseModel):
    title: str
    description: str
    duration_weeks: int
    slots: list[ProgramSnapshotSlotV1]


class CreateProgramAssignmentRequest(BaseModel):
    client_id: str = Field(min_length=1, max_length=36)
    start_date: date
    request_id: str = Field(min_length=1, max_length=128)


class ProgramAssignmentChildResponse(BaseModel):
    assignment_id: str
    program_slot_id: str
    scheduled_date: date
    status: str


class ProgramAssignmentResponse(BaseModel):
    id: str
    relationship_id: str
    trainer_id: str
    client_id: str
    source_program_id: str
    request_id: str
    start_date: date
    status: str
    snapshot_schema_version: int
    program_snapshot: ProgramSnapshotV1
    assignments: list[ProgramAssignmentChildResponse]
    created_at: datetime
    cancelled_at: datetime | None
```

- [ ] **Step 4: Implement snapshot builder and command match**

Snapshot builder receives already locked Program and ordered ProgramSlots and maps physical `program.weeks` to public `duration_weeks`. It copies each live `slot.id` into snapshot `slot_id`; it never queries Workout content.

Command match is exactly:

```python
def program_assignment_command_matches(
    existing: ProgramAssignment,
    *,
    source_program_id: str,
    start_date: date,
) -> bool:
    return (
        existing.source_program_id == source_program_id
        and existing.start_date == start_date
    )
```

- [ ] **Step 5: Implement parent repository primitives**

`programs.repository` owns only Program/ProgramSlot/ProgramAssignment rows. It must not query WorkoutAssignment.

- [ ] **Step 6: Run Task 4 GREEN**

```bash
pytest backend/tests/test_program_assignment_domain.py -q
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add backend/src/toptrainers_api/modules/programs/schemas.py \
        backend/src/toptrainers_api/modules/programs/repository.py \
        backend/src/toptrainers_api/modules/programs/service.py \
        backend/tests/test_program_assignment_domain.py
git commit -m "feat: add program assignment snapshots"
```

---

### Task 5: Implement atomic Program issuance and parent idempotency

**Files:**
- Modify: `backend/src/toptrainers_api/modules/programs/service.py`
- Modify: `backend/src/toptrainers_api/modules/programs/repository.py`
- Use public services from `assignments.service`, `clients.service`, `workouts.service`.
- Create: `backend/tests/test_program_assignment_integration.py`
- Create: `backend/tests/test_program_assignment_concurrency.py`

**Interfaces:**
- Produces exact service signature:
  `create_program_assignment(session: AsyncSession, trainer_id: str, program_id: str, payload: CreateProgramAssignmentRequest) -> ProgramAssignmentResponse`.
- Child request IDs are backend-generated opaque strings <= 128 characters and are not part of the parent public idempotency command.

- [ ] **Step 1: Write issuance RED integration tests**

Cover:

```text
empty Program assign → 409 PROGRAM_EMPTY
exact child count equals occupied slot count
(1,1) maps to start_date
(1,7) maps to start_date + 6 days
(2,1) maps to start_date + 7 days
final allowed week mapping is correct
child parent/slot provenance matches parent snapshot
Program snapshot contains no Workout content
child Workout snapshots are frozen
Program edit after issuance leaves parent snapshot/children unchanged
Workout edit after issuance leaves child snapshots unchanged
stale/unavailable Workout → 409 PROGRAM_NOT_ASSIGNABLE and no parent/children persisted
forced later-slot failure rolls back parent and every earlier materialized child
```

- [ ] **Step 2: Write parent idempotency RED tests**

Cover:

```text
same request_id + same program/start_date returns original parent ID and same child IDs
retry after Program edit returns original issuance
retry after Workout edit returns original issuance
same request_id + different start_date → 409 PROGRAM_ASSIGNMENT_REQUEST_ID_CONFLICT
same request_id + different program_id → 409 PROGRAM_ASSIGNMENT_REQUEST_ID_CONFLICT
```

- [ ] **Step 3: Run issuance RED**

```bash
pytest backend/tests/test_program_assignment_integration.py -q
```

Expected: issuance service behavior absent.

- [ ] **Step 4: Implement exact one-commit orchestration**

Transaction order:

```text
clients_service.lock_active_relationship_for_trainer_client()
→ existing parent lookup by relationship_id + request_id
   same source_program_id/start_date → build and return original response
   different command → 409
→ programs.repository.lock_for_trainer(program_id) FOR UPDATE
→ ordered live slots
→ if no slots: 409 PROGRAM_EMPTY
→ batch revalidate all slot Workout IDs with workouts_service.get_owned_workouts()
→ if owned IDs != requested IDs: 409 PROGRAM_NOT_ASSIGNABLE
→ build ProgramSnapshotV1
→ add ProgramAssignment(ACTIVE), flush
→ for every snapshot slot in week/day order:
     child_date = start_date + timedelta(days=(week-1)*7 + (day-1))
     assignments_service.materialize_assignment(... parent.id, slot.slot_id ...)
→ flush
→ commit once
→ build response using assignments_service.list_program_children()
```

No catch block may call `commit()` during the loop. On any exception the request/session boundary rolls back or explicit service error handling performs one rollback before re-raising; never persist partial issuance.

- [ ] **Step 5: Implement deterministic child response ordering**

Map `program_slot_id` to `(week_number, day_number)` using frozen `ProgramSnapshotV1`, then sort children by that frozen coordinate. Do not sort by current `scheduled_date` because a child may later be individually rescheduled.

- [ ] **Step 6: Write deterministic concurrent identical issuance test**

Use two sessions and an explicit lock gate on the Client Account/Relationship. Assert:

```text
one ProgramAssignment row
exact N children
both calls resolve to same parent ID
same child ID set returned to both
```

No sleeps as correctness mechanism.

- [ ] **Step 7: Run Task 5 GREEN**

```bash
pytest backend/tests/test_program_assignment_integration.py \
       backend/tests/test_program_assignment_concurrency.py -q
```

Expected: PASS.

- [ ] **Step 8: Commit Task 5**

```bash
git add backend/src/toptrainers_api/modules/programs/service.py \
        backend/src/toptrainers_api/modules/programs/repository.py \
        backend/tests/test_program_assignment_integration.py \
        backend/tests/test_program_assignment_concurrency.py
git commit -m "feat: issue training programs atomically"
```

---

### Task 6: Implement ProgramAssignment read/cancel and cancellation-vs-Start safety

**Files:**
- Modify: `backend/src/toptrainers_api/modules/programs/service.py`
- Modify: `backend/src/toptrainers_api/modules/programs/repository.py`
- Use public `assignments.service` child list/lock/cancel functions.
- Create: `backend/tests/test_program_cancellation_integration.py`
- Modify: `backend/tests/test_program_assignment_concurrency.py`

**Interfaces:**
- Produces `get_program_assignment(session, actor_id, actor_role, program_assignment_id) -> ProgramAssignmentResponse`.
- Produces `cancel_program_assignment(session, trainer_id, program_assignment_id) -> ProgramAssignmentResponse`.

- [ ] **Step 1: Write parent read/cancel RED tests**

Cover:

```text
Trainer reads own parent
Client reads own parent
terminated historical Relationship remains readable by both
outsider read → 404 PROGRAM_ASSIGNMENT_NOT_FOUND
foreign Trainer cancel → 403 PROGRAM_ASSIGNMENT_TRAINER_REQUIRED
Program cancel changes PLANNED children to CANCELLED
IN_PROGRESS remains IN_PROGRESS
COMPLETED remains COMPLETED
Execution/Results remain untouched
parent becomes CANCELLED and cancelled_at set once
repeat parent cancel is idempotent
individual child reschedule changes no sibling and no parent status
individual child cancel changes no sibling and no parent status
```

- [ ] **Step 2: Run RED**

```bash
pytest backend/tests/test_program_cancellation_integration.py -q
```

Expected: read/cancel service absent.

- [ ] **Step 3: Implement historical parent read**

Read path:

```text
programs.repository.get_program_assignment
→ clients_service.get_relationship
→ actor must be relationship.trainer_id or relationship.client_id
→ outsiders are hidden as PROGRAM_ASSIGNMENT_NOT_FOUND
→ assignments_service.list_program_children
→ build frozen-coordinate-ordered response
```

No Relationship ACTIVE requirement.

- [ ] **Step 4: Implement cancellation transaction**

Order:

```text
programs.repository.get_program_assignment_relationship_id
→ clients_service.lock_relationship_with_client()  # Client Account then Relationship
→ verify relationship.trainer_id == current trainer
→ programs.repository.lock_program_assignment
→ if parent already CANCELLED: return existing response
→ assignments_service.lock_program_children
→ assignments_service.cancel_planned_locked_assignments
→ parent.status = CANCELLED
→ parent.cancelled_at = utcnow
→ commit once
→ build response
```

- [ ] **Step 5: Write deterministic Cancel-vs-Start race tests**

Case A:

```text
Cancel owns Relationship lock first
→ PLANNED child becomes CANCELLED
→ Start later receives existing ASSIGNMENT_NOT_STARTABLE
```

Case B:

```text
Start owns Relationship lock first
→ child IN_PROGRESS + WorkoutExecution exists
→ later parent Cancel leaves child IN_PROGRESS
```

Always assert no row exists with `WorkoutExecution` while its Assignment status is `CANCELLED` because of this race.

- [ ] **Step 6: Run Task 6 GREEN**

```bash
pytest backend/tests/test_program_cancellation_integration.py \
       backend/tests/test_program_assignment_concurrency.py \
       backend/tests/test_execution_concurrency.py -q
```

Expected: PASS.

- [ ] **Step 7: Commit Task 6**

```bash
git add backend/src/toptrainers_api/modules/programs/service.py \
        backend/src/toptrainers_api/modules/programs/repository.py \
        backend/tests/test_program_cancellation_integration.py \
        backend/tests/test_program_assignment_concurrency.py
git commit -m "feat: cancel issued training programs safely"
```

---

### Task 7: Prove Edit-vs-Assign version atomicity and Relationship termination compatibility

**Files:**
- Modify: `backend/tests/test_program_assignment_concurrency.py`
- Create: `backend/tests/test_training_program_relationship_termination.py`
- Modify production code only if a failing test proves a defect.

**Interfaces:**
- Relies on Program `FOR UPDATE` as Edit/Assign serialization point.
- Relies on existing `clients.service.terminate_relationship()` ordinary child cancellation semantics.
- Parent status is not synchronized with Relationship termination.

- [ ] **Step 1: Write deterministic Edit-vs-Assign race test**

Seed old schedule A and replacement B with different Workout IDs/coordinates. Gate two sessions on the Program row lock and assert issuance is exactly all-A or all-B. Explicitly reject any mixed snapshot/child set.

- [ ] **Step 2: Write Relationship termination tests**

Cover:

```text
termination cancels Program-derived PLANNED child through existing assignment path
termination leaves Program-derived IN_PROGRESS child completable
completed Program child remains in existing History
ProgramAssignment parent remains ACTIVE unless explicitly cancelled
```

- [ ] **Step 3: Run Task 7**

```bash
pytest backend/tests/test_program_assignment_concurrency.py \
       backend/tests/test_training_program_relationship_termination.py -q
```

Expected: PASS. If a race fails, fix only the proven locking defect; never add parent status synchronization.

- [ ] **Step 4: Commit Task 7**

```bash
git add backend/tests/test_program_assignment_concurrency.py \
        backend/tests/test_training_program_relationship_termination.py
git commit -m "test: verify program lifecycle concurrency"
```

If production files were required to fix a proven defect, stage only those exact files as well.

---

### Task 8: Add ProgramAssignment HTTP/OpenAPI surface and prove core integration

**Files:**
- Modify: `backend/src/toptrainers_api/modules/programs/router.py`
- Modify: `backend/src/toptrainers_api/app/router.py` only if module router composition requires a second prefix router.
- Modify: `backend/tests/test_training_programs_http_contract.py`
- Create: `backend/tests/test_program_core_integration.py`
- Generated: `backend/openapi/openapi.json`

**Interfaces:**
- `POST /api/v1/programs/{program_id}/assignments` → `createProgramAssignment`.
- `GET /api/v1/program-assignments/{program_assignment_id}` → `getProgramAssignment`.
- `POST /api/v1/program-assignments/{program_assignment_id}/cancel` → `cancelProgramAssignment`.

- [ ] **Step 1: Extend RED HTTP/OpenAPI tests**

Assert exact route, operation ID, request/response schema and role/party behavior for all Program and ProgramAssignment endpoints. Also assert:

```text
Program public schema has duration_weeks and no weeks
mutable Program slots do not expose slot_id
ProgramAssignment snapshot slots do expose frozen slot_id
parent child summaries do not embed workout_snapshot
existing WorkoutAssignmentResponse schema is unchanged
```

- [ ] **Step 2: Run RED**

```bash
pytest backend/tests/test_training_programs_http_contract.py -q
```

Expected: parent routes/operation IDs missing.

- [ ] **Step 3: Implement HTTP handlers**

Use existing `BusinessRuleError` → `as_http_exception` convention. Do not add Program-specific branches to Assignment router, Results service or History service.

- [ ] **Step 4: Write end-to-end Program core integration test**

One Program-derived child must traverse the existing core:

```text
create Program
→ issue Program
→ Start child
→ PUT child Result
→ Complete child
→ Trainer reads Results
→ completed child appears in existing Workout History
```

In the same migrated schema, create a Direct Assignment and assert `program_assignment_id is None` and `program_slot_id is None`.

- [ ] **Step 5: Run core regression GREEN**

```bash
pytest backend/tests/test_program_core_integration.py \
       backend/tests/test_assignments_integration.py \
       backend/tests/test_workout_results_integration.py \
       backend/tests/test_workout_history_integration.py -q
```

Expected: PASS with no Program-aware production logic added to Results/History.

- [ ] **Step 6: Generate authoritative OpenAPI**

From `backend/`:

```bash
python scripts/export_openapi.py
```

- [ ] **Step 7: Run HTTP/OpenAPI GREEN**

```bash
pytest backend/tests/test_training_programs_http_contract.py backend/tests/test_openapi_export.py -q
```

Expected: PASS and exported OpenAPI equals checked-in artifact.

- [ ] **Step 8: Commit Task 8**

```bash
git add backend/src/toptrainers_api/modules/programs/router.py \
        backend/tests/test_training_programs_http_contract.py \
        backend/tests/test_program_core_integration.py \
        backend/openapi/openapi.json
git commit -m "feat: expose training program assignment API"
```

Stage `backend/src/toptrainers_api/app/router.py` only if actually changed.

---

### Task 9: Documentation checkpoint, complete regression gates and QA handoff

**Files:**
- Existing: `DOC/specs/2026-09-06-training-programs-v1-design.md`
- Existing: `DOC/plans/2026-09-07-training-programs-v1.md`
- Existing ADRs: `DOC/DECISIONS.md` ADR-015/ADR-016
- Modify: `DOC/PROJECT_MEMORY.md`
- Modify `DOC/ROADMAP.md` only if capability status materially changes the roadmap wording.

**Interfaces:** none.

- [ ] **Step 1: Record factual implementation checkpoint**

Add a concise `PROJECT_MEMORY.md` checkpoint stating only verified implementation facts:

```text
Training Programs v1 implemented on feature branch
migration 20260906_0010
mutable Program/full replacement schedule
immutable ProgramAssignment/ProgramSnapshot v1
atomic child WorkoutAssignment issuance
parent request_id idempotency
Program cancellation PLANNED-only
existing Execution/Results/History reused
```

Do not claim production release before merge/deploy verification.

- [ ] **Step 2: Run full backend gates**

From `backend/`:

```bash
ruff check .
mypy src
pytest
python scripts/export_openapi.py
git diff --exit-code -- openapi/openapi.json
```

Expected: zero Ruff/mypy/test/OpenAPI failures.

- [ ] **Step 3: Run frontend regression gates**

From `frontend/`:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all success. No frontend feature implementation belongs in this work item.

- [ ] **Step 4: Verify final diff constraints**

Confirm:

```text
0010 additive, no backfill
program_slot_id has no live-slot FK
no extra Program indexes beyond required constraints/FKs and child program_assignment lookup
no Program-specific Results/History business logic
no Program Sync/background scheduler/parent auto-completion
Direct Assignment API semantics unchanged
no unrelated infra/frontend files
no temporary diagnostic workflows
```

- [ ] **Step 5: Map every critical spec test to a passing test**

Required checklist:

```text
empty Program saves
empty Program assign rejected
duplicate week/day rejected
slot beyond duration rejected
foreign Trainer Workout rejected
exact child count
week-boundary date mapping
child snapshots frozen
Program edit preserves issuance
Workout edit preserves child
all-or-nothing rollback
same parent request_id no duplicates
same request_id/different command → 409
concurrent Edit vs Assign all-old/all-new
child reschedule sibling isolation
child cancel sibling isolation
Program cancellation PLANNED-only
Cancel vs Start race
Relationship termination existing semantics
Direct Assignment unchanged
Program-derived completed child works in existing Results/History
```

- [ ] **Step 6: Create or refresh Draft PR**

PR body includes exact:

```text
base SHA
head SHA
migration revision
architecture summary
TDD RED/GREEN evidence
canonical CI run number
pytest pass count
non-blocking warnings
statement that merge/deploy were not performed
```

- [ ] **Step 7: QA handoff**

Prepare `HANDOFF → 07 QA / Technical Auditor` for critical path, ownership/permissions, idempotency, frozen snapshots, migration, Edit/Assign and Cancel/Start races, Direct Assignment regression, Relationship termination, Results and History integration. Backend does not merge without owner/PM decision.
