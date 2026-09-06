# Training Programs v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the existing Trainer Program into a mutable multi-week schedule that can be issued atomically as an immutable ProgramAssignment plus ordinary frozen WorkoutAssignment children, without changing the existing Assignment → Execution → Results → History lifecycle.

**Architecture:** Keep `Program` mutable and add live `ProgramSlot` rows. Issuance creates one immutable `ProgramAssignment` snapshot and materializes all child `WorkoutAssignment` rows in one transaction through a shared commit-free Assignment service contract. `WorkoutAssignment` remains lifecycle authority; Program-derived children reuse existing reschedule/cancel/Execution/Results/History behavior.

**Tech Stack:** Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2 async, PostgreSQL 17, Alembic, pytest/pytest-asyncio, httpx ASGITransport, Ruff, mypy.

**Spec:** `DOC/specs/2026-09-06-training-programs-v1-design.md`

## Global Constraints

- Implementation starts from `design/training-programs-v1@ded75199e3ab33179e24be12135cea084585d51a`, whose merge-base is `main@9c751bc4628c198e84e0a73d5c1b9915a30c08df`.
- Before execution, create an isolated `feature/training-programs-v1` branch/worktree from the approved design head; do not implement directly on `main`.
- Migration revision is exactly `20260906_0010` with `down_revision = "20260904_0009"` and filename `backend/migrations/versions/20260906_0010_training_programs_v1.py`.
- Existing physical `programs.weeks` remains; public Program DTOs expose only `duration_weeks`.
- `week_number` is 1-based and bounded by `duration_weeks`; `day_number` is 1..7.
- `start_date` is day 1 of Program week 1 and need not be Monday.
- Child date formula is `start_date + (week_number - 1) * 7 days + (day_number - 1) days`.
- Program update is full schedule replacement and may save `slots: []`.
- Empty Program issuance is rejected.
- Mutable Program responses and frozen snapshot slots are ordered by `(week_number ASC, day_number ASC)`.
- Live `ProgramSlot.id` is internal; it is copied into the immutable issuance snapshot but is not a stable mutable-Program API identity.
- `ProgramAssignment.program_snapshot` contains Program metadata, schedule coordinates, slot IDs and Workout IDs only; never Workout content.
- Each child `WorkoutAssignment.workout_snapshot` remains the authoritative frozen Workout content.
- Child provenance is nullable `program_assignment_id` FK plus copied `program_slot_id` string without FK to live `program_slots`.
- Direct Assignment provenance fields are both NULL.
- Parent issuance is exactly one transaction / one final commit.
- Shared child materialization MUST NOT call `commit()` or `rollback()`.
- `programs` MUST NOT import `assignments.repository`; cross-module access goes through public `assignments.service` contracts.
- Program edit and Program assign serialize through Program row lock.
- Program cancellation and child Start serialize through Relationship lock before child Assignment locks.
- Parent idempotency key is `(relationship_id, request_id)`; equality uses only original `source_program_id + start_date`.
- Retry after Program or Workout edit returns the original ProgramAssignment and original children.
- Parent cancellation cancels only children that are still `PLANNED`; IN_PROGRESS/COMPLETED/Results/History remain untouched.
- Relationship termination remains Program-agnostic and cancels Program-derived PLANNED children through the existing Assignment rule.
- No Program Sync, lazy issuance, parent auto-complete, parent/child status synchronization, recurrence engine, whole-program reschedule, analytics, or frontend implementation in this work item.
- FastAPI OpenAPI is authoritative; regenerate `backend/openapi/openapi.json` through `backend/scripts/export_openapi.py`, never hand-edit it.
- Do not merge or deploy without explicit owner approval after QA.

---

## File Structure

### New production files

- `backend/src/toptrainers_api/modules/programs/repository.py` — Program/slot/ProgramAssignment SQL reads, writes and row locks only.
- `backend/src/toptrainers_api/modules/programs/service.py` — Program business rules, full replacement, parent issuance/idempotency/read/cancellation orchestration.
- `backend/migrations/versions/20260906_0010_training_programs_v1.py` — additive schema for slots, parent assignments and child provenance.

### Modified production files

- `backend/src/toptrainers_api/modules/programs/models.py` — `ProgramSlot`, `ProgramAssignment`, status enum; preserve `Program.weeks`.
- `backend/src/toptrainers_api/modules/programs/schemas.py` — canonical `duration_weeks`, schedule DTOs, snapshot DTOs and ProgramAssignment DTOs.
- `backend/src/toptrainers_api/modules/programs/router.py` — typed Program CRUD, issuance, parent read/cancel HTTP contract.
- `backend/src/toptrainers_api/modules/assignments/models.py` — nullable Program provenance and DB consistency check.
- `backend/src/toptrainers_api/modules/assignments/repository.py` — Assignment-owned queries for Program children.
- `backend/src/toptrainers_api/modules/assignments/service.py` — commit-free materializer plus public Program-child read/lock/cancel contracts; Direct Assignment refactor.
- `backend/openapi/openapi.json` — generated authoritative contract snapshot.

### Tests

- `backend/tests/conftest.py` — explicitly load Programs models into `Base.metadata`.
- `backend/tests/test_training_programs_model_contract.py` — ORM/schema invariants.
- `backend/tests/test_training_programs_migration.py` — migration columns/FKs/checks/uniques/backward compatibility.
- `backend/tests/test_training_programs_crud.py` — create/get/list/full replacement and validation.
- `backend/tests/test_training_programs_assignment_integration.py` — issuance, dates, frozen snapshots, idempotency, rollback and core integration.
- `backend/tests/test_training_programs_concurrency.py` — concurrent identical issuance, Edit vs Assign, Cancel vs Start.
- `backend/tests/test_training_programs_http_contract.py` — operation IDs, roles, errors and response shapes.
- `backend/tests/test_p0_alembic_roundtrip.py` — canonical head becomes `20260906_0010` and schema survives roundtrip.
- Existing Assignment/Execution/Results/History suites are full regression gates and must remain unchanged unless a test expectation legitimately needs the new nullable ORM columns.

### Documentation at implementation completion

- `DOC/PROJECT_MEMORY.md` — append released/verified Training Programs v1 milestone only after implementation is actually accepted/released; do not claim release during feature development.
- `DOC/DECISIONS.md` already contains ADR-015/ADR-016 on the approved design branch; no renumbering during implementation.

---

### Task 1: Add schema contract and migration

**Files:**
- Create: `backend/migrations/versions/20260906_0010_training_programs_v1.py`
- Modify: `backend/src/toptrainers_api/modules/programs/models.py`
- Modify: `backend/src/toptrainers_api/modules/assignments/models.py`
- Modify: `backend/tests/conftest.py`
- Create: `backend/tests/test_training_programs_model_contract.py`
- Create: `backend/tests/test_training_programs_migration.py`

**Interfaces:**
- Produces ORM types `ProgramSlot`, `ProgramAssignment`, `ProgramAssignmentStatus`.
- Produces `WorkoutAssignment.program_assignment_id: str | None` and `WorkoutAssignment.program_slot_id: str | None`.
- Later tasks rely on constraint names being stable and migration head `20260906_0010`.

- [ ] **Step 1: Write failing ORM contract tests**

Create assertions that prove the exact table/column contract before production code exists:

```python
def test_program_slot_contract() -> None:
    table = ProgramSlot.__table__
    assert set(table.columns.keys()) == {
        "id", "program_id", "week_number", "day_number", "workout_id"
    }
    assert [c.name for c in table.constraints if isinstance(c, UniqueConstraint)] == [
        "uq_program_slots_program_week_day"
    ]


def test_program_assignment_contract() -> None:
    table = ProgramAssignment.__table__
    assert {"relationship_id", "source_program_id", "request_id", "start_date",
            "program_snapshot", "snapshot_schema_version", "status",
            "created_at", "cancelled_at"} <= set(table.columns.keys())


def test_workout_assignment_program_provenance_is_pairwise_nullable() -> None:
    table = WorkoutAssignment.__table__
    assert table.c.program_assignment_id.nullable
    assert table.c.program_slot_id.nullable
    assert any(
        c.name == "ck_workout_assignments_program_provenance_pair"
        for c in table.constraints
    )
```

- [ ] **Step 2: Run the model test and verify RED**

Run from `backend/`:

```bash
pytest tests/test_training_programs_model_contract.py -q
```

Expected: collection/import failure because `ProgramSlot` / `ProgramAssignment` do not exist yet, or assertion failure because provenance columns do not exist.

- [ ] **Step 3: Write failing migration integration test**

The test must upgrade `0009 → 0010`, inspect `program_slots`, `program_assignments`, and `workout_assignments`, and insert a pre-existing Direct Assignment before upgrade to prove nullable provenance requires no backfill.

Key assertions:

```python
assert revision == "20260906_0010"
assert "program_slots" in tables
assert "program_assignments" in tables
assert assignment_columns["program_assignment_id"]["nullable"] is True
assert assignment_columns["program_slot_id"]["nullable"] is True
assert direct_assignment_row.program_assignment_id is None
assert direct_assignment_row.program_slot_id is None
```

- [ ] **Step 4: Run migration test and verify RED**

```bash
pytest tests/test_training_programs_migration.py -q
```

Expected: Alembic cannot resolve revision `20260906_0010` or schema assertions fail.

- [ ] **Step 5: Implement ORM models**

Use these exact logical fields:

```python
class ProgramAssignmentStatus(StrEnum):
    ACTIVE = "ACTIVE"
    CANCELLED = "CANCELLED"


class ProgramSlot(Base):
    __tablename__ = "program_slots"
    # id, program_id, week_number, day_number, workout_id


class ProgramAssignment(Base):
    __tablename__ = "program_assignments"
    # id, relationship_id, source_program_id, request_id, start_date,
    # program_snapshot JSONB, snapshot_schema_version=1,
    # status, created_at, cancelled_at
```

Use explicit named constraints:

```text
uq_program_slots_program_week_day
ck_program_slots_week_number
ck_program_slots_day_number
uq_program_assignments_relationship_request_id
ck_program_assignments_snapshot_schema_version
ck_program_assignments_status
ck_workout_assignments_program_provenance_pair
ix_workout_assignments_program_assignment_id
```

- [ ] **Step 6: Implement migration `20260906_0010`**

Upgrade order:

```text
create program_slots
create program_assignments
add workout_assignments.program_assignment_id
add workout_assignments.program_slot_id
create FK/index/check on provenance
```

Downgrade order must reverse dependent objects safely:

```text
drop provenance check/index/FK/columns
drop program_assignments
drop program_slots
```

- [ ] **Step 7: Explicitly import Programs models in test metadata bootstrap**

Add to `backend/tests/conftest.py`:

```python
from toptrainers_api.modules.programs import models as _program_models  # noqa: F401
```

- [ ] **Step 8: Run GREEN for model + migration tests**

```bash
pytest tests/test_training_programs_model_contract.py tests/test_training_programs_migration.py -q
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add backend/migrations/versions/20260906_0010_training_programs_v1.py \
  backend/src/toptrainers_api/modules/programs/models.py \
  backend/src/toptrainers_api/modules/assignments/models.py \
  backend/tests/conftest.py \
  backend/tests/test_training_programs_model_contract.py \
  backend/tests/test_training_programs_migration.py
git commit -m "feat: add training program persistence"
```

---

### Task 2: Define canonical DTOs and Program CRUD/full replacement

**Files:**
- Modify: `backend/src/toptrainers_api/modules/programs/schemas.py`
- Create: `backend/src/toptrainers_api/modules/programs/repository.py`
- Create: `backend/src/toptrainers_api/modules/programs/service.py`
- Modify: `backend/src/toptrainers_api/modules/programs/router.py`
- Create: `backend/tests/test_training_programs_crud.py`

**Interfaces:**
- Produces `ProgramSlotInput`, `TrainingProgramUpsertRequest`, `TrainingProgramResponse`.
- Produces repository locks/readers and service functions `list_programs`, `get_program`, `create_program`, `replace_program`.
- Later issuance relies on `repository.lock_owned_program()` and deterministic `repository.list_slots()`.

- [ ] **Step 1: Write RED tests for public field and deterministic empty/non-empty CRUD**

Representative schema assertion:

```python
def test_training_program_public_contract_uses_duration_weeks() -> None:
    payload = TrainingProgramUpsertRequest(
        title="Base",
        description="",
        duration_weeks=4,
        slots=[],
    )
    assert payload.duration_weeks == 4
    assert "weeks" not in payload.model_dump()
```

Integration assertions:

```python
created = await service.create_program(session, trainer_id, payload)
assert created.program.weeks == 4
assert created.slots == []

response = service.to_program_response(created)
assert response.duration_weeks == 4
assert response.slots == []
```

- [ ] **Step 2: Add RED schedule validation tests**

Cover:

```text
duplicate (week, day) => 409 PROGRAM_SLOT_DUPLICATE
week > duration_weeks => 409 PROGRAM_SLOT_OUTSIDE_DURATION
foreign or missing Workout => 404 PROGRAM_WORKOUT_NOT_FOUND
slots returned sorted by week/day
```

Use two Trainer-owned Workouts and one foreign Workout; do not mock ownership checks.

- [ ] **Step 3: Add RED full replacement rollback test**

Start with valid slots, then issue a replacement payload containing a foreign Workout. Assert the operation raises and the previously persisted title/duration/slot set is unchanged after rollback.

- [ ] **Step 4: Run CRUD tests and verify RED**

```bash
pytest tests/test_training_programs_crud.py -q
```

Expected: imports/functions missing or old `weeks` schema behavior fails.

- [ ] **Step 5: Implement schemas**

Use exact API types:

```python
class ProgramSlotInput(BaseModel):
    week_number: int = Field(ge=1)
    day_number: int = Field(ge=1, le=7)
    workout_id: str = Field(min_length=36, max_length=36)


class TrainingProgramUpsertRequest(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=2_000)
    duration_weeks: int = Field(default=1, ge=1, le=52)
    slots: list[ProgramSlotInput] = Field(default_factory=list)


class TrainingProgramResponse(TrainingProgramUpsertRequest):
    id: str
    trainer_id: str
```

Do not expose live slot IDs in `TrainingProgramResponse`.

- [ ] **Step 6: Implement Program repository**

Required query contracts:

```python
async def list_owned_programs(session: AsyncSession, trainer_id: str) -> list[Program]: ...
async def get_owned_program(session: AsyncSession, trainer_id: str, program_id: str) -> Program | None: ...
async def lock_owned_program(session: AsyncSession, trainer_id: str, program_id: str) -> Program | None: ...
async def list_slots(session: AsyncSession, program_id: str) -> list[ProgramSlot]: ...
async def delete_slots(session: AsyncSession, program_id: str) -> None: ...
```

`list_slots()` must always order by `week_number, day_number`.

- [ ] **Step 7: Implement Program service validation/full replacement**

Add helpers with deterministic business errors:

```python
def _validate_slot_coordinates(payload: TrainingProgramUpsertRequest) -> None: ...
async def _validate_workout_ownership(session, trainer_id, slots) -> None: ...
```

For replacement, perform all domain/ownership validation before deleting existing live slots, then:

```text
Program FOR UPDATE
update metadata/weeks
delete old slots
insert complete new slots
commit once
```

- [ ] **Step 8: Replace existing thin Programs router with service-backed endpoints**

Implement:

```text
GET  /programs                       listTrainingPrograms
POST /programs                       createTrainingProgram
GET  /programs/{program_id}          getTrainingProgram
PUT  /programs/{program_id}          replaceTrainingProgram
```

Trainer-only for mutation; foreign Program is hidden as `PROGRAM_NOT_FOUND`.

- [ ] **Step 9: Run CRUD tests GREEN**

```bash
pytest tests/test_training_programs_crud.py -q
```

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add backend/src/toptrainers_api/modules/programs/{schemas.py,repository.py,service.py,router.py} \
  backend/tests/test_training_programs_crud.py
git commit -m "feat: add training program schedules"
```

---

### Task 3: Extract commit-free Assignment materialization without changing Direct Assignment

**Files:**
- Modify: `backend/src/toptrainers_api/modules/assignments/service.py`
- Modify: `backend/src/toptrainers_api/modules/assignments/repository.py`
- Modify only if needed for regression assertions: existing `backend/tests/test_assignments_integration.py`
- Create: focused assertions inside `backend/tests/test_training_programs_assignment_integration.py`

**Interfaces:**
- Produces `materialize_assignment(...) -> WorkoutAssignment` with no commit/rollback.
- Produces Program-child service readers/locks used by Programs service later.
- Existing `create_assignment()` retains its exact external behavior and request-id conflict handling.

- [ ] **Step 1: Write RED transaction-ownership test for materializer**

Exercise the desired helper in an open transaction:

```python
assignment = await service.materialize_assignment(
    session,
    relationship=relationship,
    trainer_id=trainer_id,
    workout_id=workout.id,
    scheduled_date=date(2026, 9, 7),
    request_id="generated-child-id",
    program_assignment_id=None,
    program_slot_id=None,
)
assert assignment.status == WorkoutAssignmentStatus.PLANNED.value
await session.rollback()
assert await repository.get_assignment(check_session, assignment.id) is None
```

The rollback assertion proves the helper did not commit internally.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
pytest tests/test_training_programs_assignment_integration.py -k materializer -q
```

Expected: helper missing.

- [ ] **Step 3: Extract materialization from `create_assignment()`**

Use this exact callable boundary:

```python
async def materialize_assignment(
    session: AsyncSession,
    *,
    relationship: TrainerClientRelationship,
    trainer_id: str,
    workout_id: str,
    scheduled_date: date,
    request_id: str,
    program_assignment_id: str | None = None,
    program_slot_id: str | None = None,
) -> WorkoutAssignment:
    ...
```

It must:

```text
load Trainer-owned Workout
load Trainer-owned Exercises
build existing WorkoutSnapshotV1
instantiate PLANNED WorkoutAssignment
set optional provenance
session.add
flush if ID/constraints need visibility
return
```

It must not commit or rollback.

- [ ] **Step 4: Refactor Direct `create_assignment()` to call materializer once**

Preserve the current sequence:

```text
lock ACTIVE Relationship
resolve existing (relationship, request_id)
validate equality
materialize direct child with NULL provenance
commit
IntegrityError defense-in-depth for existing direct request-id unique
```

Do not change existing HTTP response shape.

- [ ] **Step 5: Add Assignment-owned Program-child repository/service contracts**

Repository functions:

```python
async def list_program_children(session: AsyncSession, program_assignment_id: str) -> list[WorkoutAssignment]: ...
async def lock_program_children(session: AsyncSession, program_assignment_id: str) -> list[WorkoutAssignment]: ...
```

Public service wrappers:

```python
async def list_program_assignment_children(session, program_assignment_id) -> list[WorkoutAssignment]: ...
async def cancel_planned_program_assignment_children(session, program_assignment_id) -> list[WorkoutAssignment]: ...
```

The cancel helper locks all children `FOR UPDATE`, mutates only `PLANNED → CANCELLED`, does not commit, and returns all children in deterministic `(scheduled_date, id)` order.

- [ ] **Step 6: Run Direct Assignment regression suite**

```bash
pytest tests/test_assignments_integration.py tests/test_assignments_http_contract.py tests/test_assignments_concurrency.py -q
```

Expected: unchanged suite passes.

- [ ] **Step 7: Run materializer test GREEN**

```bash
pytest tests/test_training_programs_assignment_integration.py -k materializer -q
```

Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add backend/src/toptrainers_api/modules/assignments/{service.py,repository.py} \
  backend/tests/test_training_programs_assignment_integration.py
git commit -m "refactor: share assignment materialization"
```

---

### Task 4: Implement atomic Program issuance and parent idempotency

**Files:**
- Modify: `backend/src/toptrainers_api/modules/programs/repository.py`
- Modify: `backend/src/toptrainers_api/modules/programs/service.py`
- Modify: `backend/src/toptrainers_api/modules/programs/schemas.py`
- Expand: `backend/tests/test_training_programs_assignment_integration.py`

**Interfaces:**
- Produces `CreateProgramAssignmentRequest`, snapshot/parent response DTOs.
- Produces `create_program_assignment(session, trainer_id, program_id, payload)`.
- Later router/concurrency tasks rely on one-commit semantics and exact error codes.

- [ ] **Step 1: Add RED issuance happy-path and date mapping tests**

Create a Program with slots `(1,1)`, `(1,7)`, `(2,1)` and `start_date=2026-09-07`.

Assert exact child dates:

```text
2026-09-07
2026-09-13
2026-09-14
```

Also assert exact child count, parent snapshot order, and provenance pair on every child.

- [ ] **Step 2: Add RED empty Program issuance test**

Expected business error:

```text
409 PROGRAM_EMPTY
```

No parent or child rows may exist afterwards.

- [ ] **Step 3: Add RED frozen Program + Workout snapshot tests**

After issuance:

```text
replace Program schedule/title
mutate source Workout title/content through supported service/test fixture
```

Assert parent `program_snapshot` and every child `workout_snapshot` remain unchanged.

- [ ] **Step 4: Add RED parent idempotency tests**

Cover:

```text
same relationship + request_id + same program + same start_date => original parent ID and child IDs
retry after Program edit => original parent/children
same request_id + different start_date => 409 PROGRAM_ASSIGNMENT_REQUEST_ID_CONFLICT
same request_id via different program path => 409 PROGRAM_ASSIGNMENT_REQUEST_ID_CONFLICT
```

- [ ] **Step 5: Add RED all-or-nothing failure test using real stale ownership**

Save a two-slot Program while both Workouts are Trainer-owned. Before issuance, directly change the second Workout's `trainer_id` in the test DB to another Trainer so the first child can materialize and the second fails ownership validation/materialization.

Assert after the failed issuance transaction:

```python
assert await count_program_assignments(...) == 0
assert await count_program_children(...) == 0
```

No mocks and no partial parent/children.

- [ ] **Step 6: Run issuance suite and verify RED**

```bash
pytest tests/test_training_programs_assignment_integration.py -k "issuance or idempot or rollback or frozen or date" -q
```

Expected: missing ProgramAssignment service/schema/repository behavior.

- [ ] **Step 7: Add ProgramAssignment DTOs**

Use exact shapes:

```python
class CreateProgramAssignmentRequest(BaseModel):
    client_id: str = Field(min_length=36, max_length=36)
    start_date: date
    request_id: str = Field(min_length=1, max_length=128)

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

class ProgramAssignmentChildResponse(BaseModel):
    assignment_id: str
    program_slot_id: str
    scheduled_date: date
    status: str
```

`ProgramAssignmentResponse` includes parent IDs, relationship parties, request/start/status, snapshot version/snapshot, deterministic child list, created/cancelled timestamps.

- [ ] **Step 8: Add ProgramAssignment repository contracts**

```python
async def get_program_assignment_by_request_id(session, relationship_id, request_id) -> ProgramAssignment | None: ...
async def get_program_assignment(session, program_assignment_id) -> ProgramAssignment | None: ...
async def lock_program_assignment(session, program_assignment_id) -> ProgramAssignment | None: ...
```

- [ ] **Step 9: Implement issuance orchestration with exactly one final commit**

Sequence must be:

```text
clients_service.lock_active_relationship_for_trainer_client
get existing parent by relationship/request_id
  same original command => return original without consulting current Program
  different command => conflict
programs.repository.lock_owned_program
load sorted slots
reject empty
revalidate all current Workout ownership
freeze ProgramSnapshotV1
create/flush ProgramAssignment
for each frozen slot in sorted order:
  scheduled_date = formula
  child_request_id = backend-generated opaque string <= 128 chars
  assignments_service.materialize_assignment(...)
flush
commit once
```

If any exception occurs, caller/service boundary rolls back the transaction before propagating the business error.

- [ ] **Step 10: Implement response assembly through public services only**

`programs.service` may call `assignments_service.list_program_assignment_children()` but may not import `assignments.repository`.

- [ ] **Step 11: Run issuance suite GREEN**

```bash
pytest tests/test_training_programs_assignment_integration.py -q
```

Expected: happy path, date mapping, snapshots, idempotency and rollback pass.

- [ ] **Step 12: Commit**

```bash
git add backend/src/toptrainers_api/modules/programs/{schemas.py,repository.py,service.py} \
  backend/tests/test_training_programs_assignment_integration.py
git commit -m "feat: issue training programs atomically"
```

---

### Task 5: Implement ProgramAssignment read and cancellation

**Files:**
- Modify: `backend/src/toptrainers_api/modules/programs/service.py`
- Modify: `backend/src/toptrainers_api/modules/programs/repository.py`
- Expand: `backend/tests/test_training_programs_assignment_integration.py`

**Interfaces:**
- Produces `get_program_assignment(session, actor_id, parent_id)` for Trainer/Client historical read.
- Produces `cancel_program_assignment(session, trainer_id, parent_id)` with Relationship-first serialization and idempotency.

- [ ] **Step 1: Write RED parent read permission tests**

Cover:

```text
own Trainer read => success
own Client read => success
terminated Relationship historical read => success for both parties
other Trainer/Client => PROGRAM_ASSIGNMENT_NOT_FOUND or hidden not-found contract
```

- [ ] **Step 2: Write RED cancellation lifecycle tests**

Issue a 3-child Program, then put one child IN_PROGRESS and one COMPLETED through existing Execution service; leave one PLANNED.

Cancel parent and assert:

```text
parent => CANCELLED with cancelled_at set
PLANNED child => CANCELLED
IN_PROGRESS child => IN_PROGRESS
COMPLETED child => COMPLETED
Execution/Results/History rows untouched
```

Repeat cancellation and assert same `cancelled_at` and no further lifecycle changes.

- [ ] **Step 3: Run cancellation/read tests and verify RED**

```bash
pytest tests/test_training_programs_assignment_integration.py -k "parent_read or program_cancel" -q
```

Expected: service functions missing.

- [ ] **Step 4: Implement historical parent read**

Flow:

```text
get parent
clients_service.get_relationship(parent.relationship_id)
hide if actor is not relationship trainer/client
list children through assignments_service
assemble response
```

Relationship status is not required to be ACTIVE for reads.

- [ ] **Step 5: Implement cancellation lock order**

Required sequence:

```text
resolve parent relationship_id without locking child
clients_service.lock_relationship_with_client   # Account → Relationship
verify relationship.trainer_id == trainer_id
programs.repository.lock_program_assignment
if already CANCELLED: return existing state
assignments_service.cancel_planned_program_assignment_children  # child FOR UPDATE
parent.status = CANCELLED
parent.cancelled_at = now
commit once
```

Do not change parent status on individual child operations or Relationship termination.

- [ ] **Step 6: Run parent read/cancel tests GREEN**

```bash
pytest tests/test_training_programs_assignment_integration.py -k "parent_read or program_cancel" -q
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/toptrainers_api/modules/programs/{service.py,repository.py} \
  backend/tests/test_training_programs_assignment_integration.py
git commit -m "feat: read and cancel program assignments"
```

---

### Task 6: Prove concurrency semantics

**Files:**
- Create: `backend/tests/test_training_programs_concurrency.py`
- Modify production code only if the RED concurrency evidence proves a locking defect.

**Interfaces:**
- Verifies existing service contracts; does not introduce a new API surface.

- [ ] **Step 1: Add concurrent identical first issuance RED test**

Use two independent AsyncSessions and a synchronization barrier so both calls target the same `(relationship, request_id)`.

Assert after both complete:

```text
both responses have same parent ID
exactly one ProgramAssignment row
exact child count, not doubled
```

- [ ] **Step 2: Add Edit vs Assign race RED test**

Prepare old schedule A and replacement schedule B. Use two sessions and barriers around Program lock acquisition. Run both winner orders.

Assert each issuance snapshot/children correspond entirely to A or entirely to B; never a mixed set.

- [ ] **Step 3: Add Program Cancel vs child Start race RED test**

Run both winner orders using independent sessions:

```text
Cancel wins => child CANCELLED; Start receives existing ASSIGNMENT_NOT_STARTABLE; no Execution
Start wins => child IN_PROGRESS + Execution exists; later parent cancel leaves child IN_PROGRESS
```

Explicit invariant:

```python
assert not (assignment.status == "CANCELLED" and execution is not None)
```

- [ ] **Step 4: Run concurrency suite and inspect failures**

```bash
pytest tests/test_training_programs_concurrency.py -q
```

Expected before final locking implementation: at least one race may fail; failures must identify the exact missing lock/order, not be patched with sleeps.

- [ ] **Step 5: Make only evidence-driven locking corrections**

Permitted locking points are those in the approved spec:

```text
Edit: Program
Assign: Account → Relationship → Program
Start: Account → Relationship → Assignment → Execution
Parent Cancel: Account → Relationship → ProgramAssignment → children
```

Do not add global/advisory locks or a second Program lifecycle engine.

- [ ] **Step 6: Run concurrency suite GREEN repeatedly**

```bash
pytest tests/test_training_programs_concurrency.py -q
pytest tests/test_training_programs_concurrency.py -q
pytest tests/test_training_programs_concurrency.py -q
```

Expected: all three runs pass with no deadlock/timeouts.

- [ ] **Step 7: Commit**

```bash
git add backend/tests/test_training_programs_concurrency.py \
  backend/src/toptrainers_api/modules/programs \
  backend/src/toptrainers_api/modules/assignments
git commit -m "test: cover training program concurrency"
```

---

### Task 7: Publish the HTTP contract and authoritative OpenAPI

**Files:**
- Modify: `backend/src/toptrainers_api/modules/programs/router.py`
- Create: `backend/tests/test_training_programs_http_contract.py`
- Modify generated: `backend/openapi/openapi.json`

**Interfaces:**
- Produces operation IDs `listTrainingPrograms`, `createTrainingProgram`, `getTrainingProgram`, `replaceTrainingProgram`, `createProgramAssignment`, `getProgramAssignment`, `cancelProgramAssignment`.

- [ ] **Step 1: Write RED HTTP permission/error tests**

Use dependency overrides / ASGITransport consistent with existing HTTP contract tests.

Cover:

```text
Client mutation Program => 403 ROLE_NOT_ALLOWED
foreign Program => 404 PROGRAM_NOT_FOUND
empty Program assignment => 409 PROGRAM_EMPTY
same request_id/different command => 409 PROGRAM_ASSIGNMENT_REQUEST_ID_CONFLICT
foreign ProgramAssignment read hidden
Trainer parent cancel success + repeated cancel success
```

- [ ] **Step 2: Write RED OpenAPI operation/schema assertions**

Assert exact paths and operation IDs exist in `app.openapi()` and public Program schemas expose `duration_weeks` but not `weeks`.

- [ ] **Step 3: Run HTTP/OpenAPI tests and verify RED**

```bash
pytest tests/test_training_programs_http_contract.py tests/test_openapi_export.py -q
```

Expected: new endpoints/operation IDs absent and checked-in OpenAPI drift after router implementation until export.

- [ ] **Step 4: Implement router endpoints**

Add business-error mapping consistent with Assignments router and no raw repository access.

HTTP surface:

```text
GET  /api/v1/programs
POST /api/v1/programs
GET  /api/v1/programs/{program_id}
PUT  /api/v1/programs/{program_id}
POST /api/v1/programs/{program_id}/assignments
GET  /api/v1/program-assignments/{program_assignment_id}
POST /api/v1/program-assignments/{program_assignment_id}/cancel
```

- [ ] **Step 5: Export authoritative OpenAPI**

From `backend/`:

```bash
python scripts/export_openapi.py
```

Do not hand-edit JSON.

- [ ] **Step 6: Run HTTP/OpenAPI tests GREEN**

```bash
pytest tests/test_training_programs_http_contract.py tests/test_openapi_export.py -q
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/toptrainers_api/modules/programs/router.py \
  backend/tests/test_training_programs_http_contract.py \
  backend/openapi/openapi.json
git commit -m "feat: expose training program API"
```

---

### Task 8: Prove existing core integration and no sibling coupling

**Files:**
- Expand: `backend/tests/test_training_programs_assignment_integration.py`
- Production History/Results code should remain unchanged unless a genuine regression is proven.

**Interfaces:**
- Verifies Program-derived children remain ordinary WorkoutAssignments.

- [ ] **Step 1: Add child independence tests**

Issue at least three children.

Assert:

```text
reschedule child A => B/C dates unchanged, parent snapshot unchanged
cancel child B => A/C statuses unchanged, parent remains ACTIVE
```

Use existing Assignment service endpoints/functions, not Program-specific mutation shortcuts.

- [ ] **Step 2: Add Relationship termination regression test**

Issue Program children, start one, leave another PLANNED, then terminate Relationship through existing clients service.

Assert existing semantics:

```text
PLANNED Program child => CANCELLED
IN_PROGRESS child => remains IN_PROGRESS and can later Complete
parent ProgramAssignment status remains ACTIVE
```

- [ ] **Step 3: Add Results + History end-to-end test for Program child**

For one Program-derived child:

```text
Start
PUT Results
Complete
Trainer GET Results
query existing Workout History
```

Assert it appears exactly like a Direct Assignment child and no Program-specific History/Results branch is required.

- [ ] **Step 4: Add Direct Assignment provenance regression**

Create a normal Direct Assignment and assert in DB:

```python
assert assignment.program_assignment_id is None
assert assignment.program_slot_id is None
```

Existing response remains unchanged.

- [ ] **Step 5: Run integration tests GREEN**

```bash
pytest tests/test_training_programs_assignment_integration.py \
  tests/test_execution_integration.py \
  tests/test_workout_results_integration.py \
  tests/test_workout_history_integration.py -q
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/tests/test_training_programs_assignment_integration.py
git commit -m "test: verify program children reuse workout core"
```

---

### Task 9: Update canonical Alembic head and run full backend regression

**Files:**
- Modify: `backend/tests/test_p0_alembic_roundtrip.py`

**Interfaces:**
- Canonical migration head becomes `20260906_0010`.

- [ ] **Step 1: Extend Alembic state helper to inspect Program tables/provenance**

Track at minimum:

```text
PROGRAM_SLOT_TABLE = "program_slots"
PROGRAM_ASSIGNMENT_TABLE = "program_assignments"
```

and WorkoutAssignment provenance column names.

- [ ] **Step 2: Change both final head assertions from `20260904_0009` to `20260906_0010`**

Also assert head contains both new Program tables and provenance columns.

- [ ] **Step 3: Add explicit `0010 → 0009 → 0010` development roundtrip segment**

At `0009`, assert Program tables/provenance are absent while pre-existing Assignment schema remains. Re-upgrade and assert they return.

- [ ] **Step 4: Run Alembic regression**

```bash
pytest tests/test_p0_alembic_roundtrip.py tests/test_training_programs_migration.py -q
```

Expected: pass.

- [ ] **Step 5: Run complete backend suite**

```bash
pytest -q
```

Expected: 0 failures. Record exact pass/warning counts for PR evidence.

- [ ] **Step 6: Run backend quality gates**

```bash
ruff check .
mypy src
```

Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add backend/tests/test_p0_alembic_roundtrip.py
git commit -m "test: advance migration head for training programs"
```

---

### Task 10: Final contract/regression verification and PR preparation

**Files:**
- Potential generated update only if exporter changed: `backend/openapi/openapi.json`
- Update implementation status only when true: `DOC/PROJECT_MEMORY.md`
- Do not modify frontend unless a separate Frontend handoff is approved.

**Interfaces:**
- Produces QA-ready feature branch/PR; no merge/deploy.

- [ ] **Step 1: Verify the approved spec line-by-line against final diff**

Checklist must explicitly account for every critical requirement:

```text
empty Program saves
empty Program assign rejected
duplicate week/day rejected
slot beyond duration rejected
foreign Trainer Workout hidden
exact child count
week-boundary date mapping
child snapshots frozen
Program edit leaves issuance unchanged
Workout edit leaves child unchanged
partial issuance rollback
same request_id retry
same request_id/different command conflict
Edit vs Assign atomic version
child reschedule independent
child cancel independent
Program cancellation PLANNED only
Cancel vs Start race
Relationship termination unchanged
Direct Assignment unchanged
Program child Results/History integration
```

- [ ] **Step 2: Re-export OpenAPI and prove no drift**

```bash
python scripts/export_openapi.py
git diff --exit-code backend/openapi/openapi.json
```

Expected: no diff after committed generated snapshot.

- [ ] **Step 3: Run full canonical local verification**

From `backend/`:

```bash
ruff check .
mypy src
pytest -q
```

From repository root/frontend according to existing CI commands:

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If frontend fails solely because generated backend contract consumers need adaptation, stop backend scope expansion and prepare a HANDOFF to `05 Frontend / PWA Lead`; do not silently implement frontend behavior here.

- [ ] **Step 4: Inspect final branch diff**

Expected production scope:

```text
programs models/schemas/repository/service/router
assignments models/repository/service
migration 0010
backend tests
OpenAPI snapshot
approved spec/plan/ADR docs
```

No infra, deployment, unrelated UI or `arc/` changes.

- [ ] **Step 5: Update `DOC/PROJECT_MEMORY.md` only with implementation status that is actually true**

Before merge/release, wording must say feature implemented/QA-pending rather than production-released. Production verification is recorded only after merge/deploy verification by the appropriate release role.

- [ ] **Step 6: Commit final documentation/status adjustment**

```bash
git add DOC/PROJECT_MEMORY.md backend/openapi/openapi.json
git commit -m "docs: record training programs implementation status"
```

Skip the commit if neither file changed.

- [ ] **Step 7: Open Draft PR to `main`**

PR body must include:

```text
base SHA
head SHA
migration 20260906_0010
atomic issuance / one-commit guarantee
parent idempotency semantics
lock-order guarantees
exact pytest count
Ruff/mypy result
frontend CI result
OpenAPI drift result
known non-blocking warnings
```

Do not mark ready for merge until canonical GitHub CI passes on the exact PR head.

- [ ] **Step 8: Run canonical GitHub CI and verify exact head**

Required jobs:

```text
Backend quality checks
Backend tests (PostgreSQL)
Frontend checks
```

All must be success on current head. Fetch PostgreSQL logs and record exact pytest result.

- [ ] **Step 9: Prepare QA HANDOFF**

Send to `07 QA / Technical Auditor` with explicit focus on:

```text
permissions
full replacement validation
snapshot immutability
atomic rollback
idempotency after edits
Edit vs Assign race
Cancel vs Start race
Relationship termination regression
Direct Assignment regression
Results/History integration
migration 0010
OpenAPI/error contracts
```

No merge or deploy from Backend Lead without explicit owner/release coordination.
