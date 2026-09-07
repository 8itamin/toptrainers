# Training Programs v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the existing mutable Trainer Program into a reusable multi-week schedule that can be atomically issued to a Client as immutable `ProgramAssignment` plus ordinary frozen `WorkoutAssignment` children without changing the existing `Assignment → Execution → Results → History` lifecycle.

**Architecture:** `programs` remains the owner of mutable Program metadata/schedule and ProgramAssignment orchestration. Issuance freezes only Program metadata/schedule/Workout IDs in `ProgramAssignment.program_snapshot`, then calls a shared commit-free `assignments.service.materialize_assignment()` for every slot and commits exactly once. Child `WorkoutAssignment` remains lifecycle authority; Program cancellation only cancels children that are still `PLANNED` and all Program/child races serialize through the existing Account/Relationship lock order plus Program/ProgramAssignment locks.

**Tech Stack:** Python 3.13, FastAPI, SQLAlchemy 2 async, PostgreSQL 17, Alembic, PostgreSQL JSONB, Pydantic v2, pytest/pytest-asyncio, Ruff, mypy, Angular/Nx regression gates, generated FastAPI OpenAPI.

**Spec:** `DOC/specs/2026-09-06-training-programs-v1-design.md`

## Global Constraints

- Implementation baseline: `main@9c751bc4628c198e84e0a73d5c1b9915a30c08df` unless `main` advances before execution; if it advances, rebase/branch from the new `main` and re-run all regression gates.
- Design documentation baseline: `design/training-programs-v1@ded75199e3ab33179e24be12135cea084585d51a`.
- Migration: `20260906_0010_training_programs_v1`, additive, `down_revision = 20260904_0009`.
- Existing physical `programs.weeks` remains; public Program field is only `duration_weeks`.
- `duration_weeks: 1..52`; `week_number >= 1`; `day_number: 1..7`; one slot maximum per `(program_id, week_number, day_number)`.
- `start_date` is day 1 of week 1 and need not be Monday; child date = `start_date + (week_number-1)*7 + (day_number-1)` days.
- Mutable Program slot command DTOs expose only `week_number`, `day_number`, `workout_id`; live `ProgramSlot.id` is internal and not stable public identity.
- Mutable Program schedule responses, Program snapshots and ProgramAssignment child summaries are ordered by `(week_number ASC, day_number ASC)`.
- Empty Program may be saved; empty Program issuance returns `409 PROGRAM_EMPTY`.
- Foreign/nonexistent Workout is hidden as `404 PROGRAM_WORKOUT_NOT_FOUND` during Program save/update.
- Stale/unavailable Workout during issuance returns `409 PROGRAM_NOT_ASSIGNABLE`; issuance is fully rolled back.
- `ProgramAssignment.program_snapshot` contains Program metadata, schedule coordinates, live slot IDs copied as snapshot provenance, and Workout IDs only; never Workout content.
- Child `WorkoutAssignment.workout_snapshot` remains the authoritative frozen Workout content.
- Child provenance: nullable `program_assignment_id` FK + nullable immutable copied `program_slot_id` string without FK to live `program_slots`; both NULL or both non-NULL.
- Direct Assignment provenance remains NULL/NULL and existing HTTP semantics remain unchanged.
- Parent idempotency key is `(relationship_id, request_id)`; retry equality uses only `source_program_id + start_date`, never current Program/Workout state.
- Issuance has exactly one final commit. Shared Assignment materializer MUST NOT commit or rollback.
- Program Edit vs Assign serializes on Program row lock; outcome is all-old or all-new schedule, never mixed.
- Program cancellation vs child Start serializes through Client Account → Relationship before ProgramAssignment/Assignment locks.
- Program cancellation cancels only `PLANNED` children; `IN_PROGRESS`, `COMPLETED`, Execution, Results and History remain untouched.
- Relationship termination remains Program-agnostic and relies on ordinary child Assignments.
- No Program Sync, lazy issuance, background scheduler, parent auto-complete, parent/child status synchronization, whole-program reschedule, recurrence engine, analytics/adherence or frontend UI in v1.
- Backend modules MUST NOT import another module's repository directly; cross-module access uses public service contracts.
- FastAPI-generated OpenAPI is authoritative; never hand-edit `backend/openapi/openapi.json`.
- Do not modify `arc/`.

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
- Migration head becomes `20260906_0010`.

- [ ] **Step 1: Write failing ORM contract tests**

Create tests that assert exact schema ownership and constraints:

```python
def test_program_slot_contract() -> None:
    table = ProgramSlot.__table__
    assert table.c.program_id.foreign_keys
    assert table.c.workout_id.foreign_keys
    assert table.c.week_number.nullable is False
    assert table.c.day_number.nullable is False
    unique_columns = {
        tuple(column.name for column in constraint.columns)
        for constraint in table.constraints
        if isinstance(constraint, UniqueConstraint)
    }
    assert ("program_id", "week_number", "day_number") in unique_columns


def test_program_assignment_contract() -> None:
    table = ProgramAssignment.__table__
    assert table.c.relationship_id.nullable is False
    assert table.c.source_program_id.nullable is False
    assert table.c.program_snapshot.type.__class__.__name__ == "JSONB"
    assert table.c.snapshot_schema_version.nullable is False
    assert table.c.status.nullable is False


def test_workout_assignment_program_provenance_is_nullable_pair() -> None:
    table = WorkoutAssignment.__table__
    assert table.c.program_assignment_id.nullable is True
    assert table.c.program_slot_id.nullable is True
    assert table.c.program_assignment_id.foreign_keys
    assert not table.c.program_slot_id.foreign_keys
```

Also assert named checks for slot bounds, parent status/schema version, and the child provenance pair invariant.

- [ ] **Step 2: Run RED**

Run from repository root:

```bash
pytest backend/tests/test_training_programs_model_contract.py -q
```

Expected: import/attribute failures because ProgramSlot/ProgramAssignment/provenance do not exist.

- [ ] **Step 3: Implement ORM models minimally**

In `programs/models.py`, add:

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
    # program_snapshot, snapshot_schema_version, status, created_at, cancelled_at
```

Use exact constraints from the spec. Do not rename `Program.weeks`.

In `assignments/models.py`, add nullable provenance and:

```text
CHECK (
  (program_assignment_id IS NULL AND program_slot_id IS NULL)
  OR
  (program_assignment_id IS NOT NULL AND program_slot_id IS NOT NULL)
)
```

Add an index on `program_assignment_id` only.

- [ ] **Step 4: Write migration tests before migration implementation**

Tests must verify:

```text
0009 → 0010
program_slots exists
program_assignments exists
workout_assignments provenance columns exist and are nullable
existing direct assignment row survives with NULL/NULL provenance
0010 → 0009 in isolated empty/dev test database removes only new schema
0009 → 0010 again succeeds
```

Update the canonical Alembic roundtrip expected head from `20260904_0009` to `20260906_0010`.

- [ ] **Step 5: Run migration RED**

```bash
pytest backend/tests/test_training_programs_migration.py backend/tests/test_p0_alembic_roundtrip.py -q
```

Expected: migration/head failures because `0010` is absent.

- [ ] **Step 6: Implement additive Alembic migration**

Create `20260906_0010_training_programs_v1.py` with exact tables, constraints, FK behavior and provenance fields. No data backfill and no unrelated indexes.

- [ ] **Step 7: Run Task 1 GREEN**

```bash
pytest backend/tests/test_training_programs_model_contract.py backend/tests/test_training_programs_migration.py backend/tests/test_p0_alembic_roundtrip.py -q
```

Expected: PASS on PostgreSQL test DB.

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

### Task 2: Evolve Program DTOs and implement atomic full-schedule CRUD

**Files:**
- Modify: `backend/src/toptrainers_api/modules/programs/schemas.py`
- Create: `backend/src/toptrainers_api/modules/programs/repository.py`
- Create: `backend/src/toptrainers_api/modules/programs/service.py`
- Modify: `backend/src/toptrainers_api/modules/programs/router.py`
- Create: `backend/tests/test_training_programs_domain.py`
- Create: `backend/tests/test_training_programs_http_contract.py`

**Interfaces:**
- Produces `ProgramSlotCommand`, `ProgramCreateRequest`, `ProgramReplaceRequest`, `ProgramSlotResponse`, `ProgramResponse`.
- Produces service functions:
  - `list_programs(session, trainer_id) -> list[Program]`
  - `get_program(session, trainer_id, program_id) -> Program`
  - `create_program(session, trainer_id, payload) -> Program`
  - `replace_program(session, trainer_id, program_id, payload) -> Program`
- `ProgramResponse.duration_weeks` maps from physical `Program.weeks`; `weeks` never appears publicly.

- [ ] **Step 1: Write RED schema/domain tests**

Cover exact DTO and validation behavior:

```python
def test_program_public_contract_uses_duration_weeks_only() -> None:
    response = ProgramResponse(..., duration_weeks=4, slots=[])
    payload = response.model_dump()
    assert payload["duration_weeks"] == 4
    assert "weeks" not in payload


def test_empty_program_is_valid() -> None:
    payload = ProgramCreateRequest(title="Base", duration_weeks=4, slots=[])
    assert payload.slots == []
```

Write service/integration cases for:

```text
empty Program saves
duplicate week/day → 409 PROGRAM_SLOT_DUPLICATE
slot beyond duration → 409 PROGRAM_SLOT_OUTSIDE_DURATION
foreign/nonexistent Trainer Workout → 404 PROGRAM_WORKOUT_NOT_FOUND
PUT replaces metadata + complete schedule
PUT failure leaves old metadata/schedule unchanged
response slot order is week/day ascending
```

- [ ] **Step 2: Run RED**

```bash
pytest backend/tests/test_training_programs_domain.py backend/tests/test_training_programs_http_contract.py -q
```

Expected: missing schemas/service/repository/endpoints.

- [ ] **Step 3: Implement schemas with public `duration_weeks`**

Use request slot shape only:

```python
class ProgramSlotCommand(BaseModel):
    week_number: int = Field(ge=1)
    day_number: int = Field(ge=1, le=7)
    workout_id: str = Field(min_length=36, max_length=36)
```

`ProgramCreateRequest` and `ProgramReplaceRequest` use `duration_weeks: int = Field(ge=1, le=52)` and `slots: list[ProgramSlotCommand] = []` semantics without exposing internal slot IDs.

- [ ] **Step 4: Implement Program repository**

Repository owns only Program/ProgramSlot SQL:

```text
list owned Programs
get owned Program + ordered slots
lock owned Program FOR UPDATE
replace all slots inside caller transaction
```

Do not import Workout repository. Workout ownership validation goes through `workouts.service` public contract.

- [ ] **Step 5: Implement Program service full replacement transaction**

Create path:

```text
validate duplicate coordinate in memory
validate week_number <= duration_weeks
validate every Workout belongs to trainer using workouts service
create Program + backend slot IDs
commit once
```

Replace path:

```text
Program FOR UPDATE
→ validate entire payload and Workout ownership before destructive slot replacement
→ update metadata/weeks
→ replace all live slots
→ commit once
```

Any failure before commit must preserve old Program state.

- [ ] **Step 6: Implement Program HTTP surface**

Exact operations:

```text
GET  /api/v1/programs                       listTrainingPrograms
POST /api/v1/programs                       createTrainingProgram
GET  /api/v1/programs/{program_id}          getTrainingProgram
PUT  /api/v1/programs/{program_id}          replaceTrainingProgram
```

Trainer-only mutation/read scope. Use existing `BusinessRuleError` / `as_http_exception` convention instead of ad-hoc response bodies.

- [ ] **Step 7: Run Task 2 GREEN**

```bash
pytest backend/tests/test_training_programs_domain.py backend/tests/test_training_programs_http_contract.py -q
```

Expected: PASS.

- [ ] **Step 8: Commit Task 2**

```bash
git add backend/src/toptrainers_api/modules/programs \
        backend/tests/test_training_programs_domain.py \
        backend/tests/test_training_programs_http_contract.py
git commit -m "feat: add mutable training program schedules"
```

---

### Task 3: Extract shared commit-free WorkoutAssignment materializer

**Files:**
- Modify: `backend/src/toptrainers_api/modules/assignments/service.py`
- Modify if needed: `backend/src/toptrainers_api/modules/assignments/repository.py`
- Create: `backend/tests/test_assignment_materializer.py`
- Modify: `backend/tests/test_assignments_integration.py`
- Modify: `backend/tests/test_assignments_http_contract.py`

**Interfaces:**
- Produces exact public service contract:

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

- `materialize_assignment()` never commits and never rolls back.
- Existing `create_assignment()` delegates to this materializer after its current direct idempotency/authorization checks and still owns its existing commit behavior externally.

- [ ] **Step 1: Write RED materializer tests**

Test directly with a transaction/session:

```text
materializer creates PLANNED assignment
snapshot equals current owned Workout content at materialization time
program provenance NULL/NULL by default
provided program provenance stored exactly
no commit occurs: caller rollback removes materialized row
foreign/missing Workout retains existing Direct Assignment error semantics
```

- [ ] **Step 2: Run RED**

```bash
pytest backend/tests/test_assignment_materializer.py -q
```

Expected: missing `materialize_assignment`.

- [ ] **Step 3: Extract minimal commit-free implementation**

Move only the shared owned Workout/Exercise lookup, `build_workout_snapshot_v1()`, `WorkoutAssignment` instantiation and `session.add()`/`flush()` responsibility. Do not move direct request-id handling into the materializer.

- [ ] **Step 4: Refactor existing Direct Assignment to call materializer**

Preserve the existing order:

```text
Client Account → ACTIVE Relationship
→ direct `(relationship_id, request_id)` idempotency check
→ materialize_assignment(... provenance None/None)
→ direct service commit
```

Keep current `ASSIGNMENT_REQUEST_ID_CONFLICT`, response DTO and route behavior unchanged.

- [ ] **Step 5: Run Direct Assignment regression GREEN**

```bash
pytest backend/tests/test_assignment_materializer.py \
       backend/tests/test_assignments_integration.py \
       backend/tests/test_assignments_http_contract.py -q
```

Expected: PASS, with existing direct API snapshot and idempotency unchanged.

- [ ] **Step 6: Commit Task 3**

```bash
git add backend/src/toptrainers_api/modules/assignments/service.py \
        backend/src/toptrainers_api/modules/assignments/repository.py \
        backend/tests/test_assignment_materializer.py \
        backend/tests/test_assignments_integration.py \
        backend/tests/test_assignments_http_contract.py
git commit -m "refactor: extract assignment materializer"
```

---

### Task 4: Add ProgramAssignment persistence, snapshots and idempotent read model

**Files:**
- Modify: `backend/src/toptrainers_api/modules/programs/schemas.py`
- Modify: `backend/src/toptrainers_api/modules/programs/repository.py`
- Modify: `backend/src/toptrainers_api/modules/programs/service.py`
- Create: `backend/tests/test_program_assignment_domain.py`

**Interfaces:**
- Produces `ProgramSnapshotSlotV1`, `ProgramSnapshotV1`, `CreateProgramAssignmentRequest`, `ProgramAssignmentChildResponse`, `ProgramAssignmentResponse`.
- Repository functions include:
  - `get_assignment_by_request_id(session, relationship_id, request_id)`
  - `get_program_assignment(session, id)`
  - `lock_program_assignment(session, id)`
- Service response helper reconstructs trainer/client IDs from Relationship and returns children ordered by frozen snapshot coordinate, not current child `scheduled_date`.

- [ ] **Step 1: Write RED snapshot/idempotency model tests**

Assert:

```text
snapshot includes title, description, duration_weeks, slots
snapshot slot includes slot_id/week/day/workout_id
snapshot excludes Workout content
snapshot slots ordered week/day
parent command equality compares source_program_id + start_date only
child summary exposes assignment_id/program_slot_id/scheduled_date/status
```

- [ ] **Step 2: Run RED**

```bash
pytest backend/tests/test_program_assignment_domain.py -q
```

Expected: missing snapshot/parent schemas and service helpers.

- [ ] **Step 3: Implement Program snapshot schemas and builder**

Builder input is the already locked current Program + ordered live slots. It must never read current Workout content into the Program snapshot.

- [ ] **Step 4: Implement parent repository primitives**

Keep Program/ProgramSlot/ProgramAssignment persistence in `programs.repository`. Do not query/lock child WorkoutAssignments here.

- [ ] **Step 5: Implement immutable command-match helper**

Conceptual helper:

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

Do not compare current Program title/weeks/slots or Workout content.

- [ ] **Step 6: Run Task 4 GREEN**

```bash
pytest backend/tests/test_program_assignment_domain.py -q
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add backend/src/toptrainers_api/modules/programs \
        backend/tests/test_program_assignment_domain.py
git commit -m "feat: add program assignment snapshots"
```

---

### Task 5: Implement atomic Program issuance and parent idempotency

**Files:**
- Modify: `backend/src/toptrainers_api/modules/programs/service.py`
- Modify: `backend/src/toptrainers_api/modules/programs/repository.py`
- Use public service: `backend/src/toptrainers_api/modules/assignments/service.py`
- Create: `backend/tests/test_program_assignment_integration.py`
- Create: `backend/tests/test_program_assignment_concurrency.py`

**Interfaces:**
- Produces:

```python
async def create_program_assignment(
    session: AsyncSession,
    trainer_id: str,
    program_id: str,
    payload: CreateProgramAssignmentRequest,
) -> ProgramAssignmentResponse:
    ...
```

- Calls `clients_service.lock_active_relationship_for_trainer_client()` first, then checks parent idempotency, then locks Program, freezes snapshot and materializes children.
- Child request IDs are backend-generated opaque strings <= 128 chars.

- [ ] **Step 1: Write issuance RED integration tests**

Required cases:

```text
empty Program assign → 409 PROGRAM_EMPTY
exact child count == occupied slot count
(1,1) == start_date
(1,7) == start_date + 6 days
(2,1) == start_date + 7 days
last slot in duration maps correctly
child Program provenance matches parent/snapshot slot
child Workout snapshots frozen
Program edit after issuance leaves parent/children unchanged
Workout edit after issuance leaves child snapshots unchanged
stale/unavailable Workout causes PROGRAM_NOT_ASSIGNABLE and zero parent/children persisted
injected failure on any later slot rolls back parent + every previously materialized child
```

- [ ] **Step 2: Write parent idempotency RED tests**

```text
same request_id + same program/start_date → original parent ID and same child IDs
retry after Program edit → original issuance
retry after Workout edit → original issuance
same request_id + different start_date → 409 PROGRAM_ASSIGNMENT_REQUEST_ID_CONFLICT
same request_id + different program_id → 409 PROGRAM_ASSIGNMENT_REQUEST_ID_CONFLICT
```

- [ ] **Step 3: Run RED**

```bash
pytest backend/tests/test_program_assignment_integration.py -q
```

Expected: missing issuance service behavior.

- [ ] **Step 4: Implement one-commit issuance**

Exact transaction order:

```text
Client Account FOR UPDATE
→ ACTIVE Relationship FOR UPDATE
→ existing ProgramAssignment lookup by relationship_id + request_id
   same original command → return original immediately
   different original command → 409
→ owned Program FOR UPDATE
→ ordered current slots
→ reject empty
→ revalidate every slot Workout remains Trainer-owned/available
→ freeze ProgramSnapshotV1
→ add ProgramAssignment(ACTIVE), flush parent id
→ for each snapshot slot in order:
     scheduled_date = start_date + offset
     assignments_service.materialize_assignment(...)
→ flush all children
→ commit exactly once
```

Use generated child `request_id` values independent of parent public idempotency semantics.

- [ ] **Step 5: Write deterministic concurrent first-issuance RED test**

Two transactions issue the same Program to the same Client with the same parent `request_id`. Hold/release the Relationship lock deterministically; do not use sleeps as correctness mechanism.

Expected after implementation:

```text
one ProgramAssignment row
exactly N child WorkoutAssignments
both callers resolve to the same parent/children
```

- [ ] **Step 6: Run Task 5 GREEN**

```bash
pytest backend/tests/test_program_assignment_integration.py \
       backend/tests/test_program_assignment_concurrency.py -q
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add backend/src/toptrainers_api/modules/programs \
        backend/tests/test_program_assignment_integration.py \
        backend/tests/test_program_assignment_concurrency.py
git commit -m "feat: issue training programs atomically"
```

---

### Task 6: Implement Program cancellation and lifecycle race serialization

**Files:**
- Modify: `backend/src/toptrainers_api/modules/assignments/repository.py`
- Modify: `backend/src/toptrainers_api/modules/assignments/service.py`
- Modify: `backend/src/toptrainers_api/modules/programs/service.py`
- Create: `backend/tests/test_program_cancellation_integration.py`
- Modify: `backend/tests/test_program_assignment_concurrency.py`

**Interfaces:**
- `assignments.service` adds public commit-free child-owner operations, for example:

```python
async def lock_program_children(
    session: AsyncSession,
    program_assignment_id: str,
) -> list[WorkoutAssignment]:
    ...


def cancel_planned_locked_assignments(assignments: list[WorkoutAssignment]) -> None:
    ...
```

These functions live in `assignments` because WorkoutAssignment is its aggregate. They do not commit.

- Produces `programs.service.cancel_program_assignment(session, trainer_id, program_assignment_id)`.

- [ ] **Step 1: Write cancellation RED tests**

Cover:

```text
Program cancel changes PLANNED children to CANCELLED
IN_PROGRESS child remains IN_PROGRESS
COMPLETED child remains COMPLETED
Results/Execution remain untouched
parent becomes CANCELLED and cancelled_at is set once
repeat parent cancel is idempotent
individual child reschedule changes no sibling and no parent status
individual child cancel changes no sibling and no parent status
```

- [ ] **Step 2: Run RED**

```bash
pytest backend/tests/test_program_cancellation_integration.py -q
```

Expected: cancellation service absent.

- [ ] **Step 3: Implement module-safe child locking/cancellation contract**

In `assignments.repository`, query children by `program_assignment_id` ordered by ID and `FOR UPDATE`.

In `assignments.service`, expose commit-free child lock/cancel helper. `programs.service` MUST NOT import `assignments.repository` directly.

- [ ] **Step 4: Implement parent cancellation transaction**

Order:

```text
resolve parent relationship_id
→ clients_service.lock_relationship_with_client()  # Account then Relationship
→ verify relationship.trainer_id == current trainer
→ lock ProgramAssignment
→ if already CANCELLED: return current response
→ assignments_service.lock_program_children()
→ cancel only PLANNED rows in memory
→ parent.status = CANCELLED
→ parent.cancelled_at = now
→ commit once
```

- [ ] **Step 5: Write deterministic Cancel-vs-Start race tests**

Two ordered cases:

```text
Cancel holds Relationship first → PLANNED child CANCELLED → later Start rejected by existing ASSIGNMENT_NOT_STARTABLE
Start holds Relationship first → child IN_PROGRESS + Execution → later parent Cancel leaves child IN_PROGRESS
```

Always assert impossible state never appears:

```text
WorkoutExecution exists AND corresponding WorkoutAssignment.status == CANCELLED
```

- [ ] **Step 6: Run Task 6 GREEN**

```bash
pytest backend/tests/test_program_cancellation_integration.py \
       backend/tests/test_program_assignment_concurrency.py \
       backend/tests/test_execution_concurrency.py -q
```

Expected: PASS.

- [ ] **Step 7: Commit Task 6**

```bash
git add backend/src/toptrainers_api/modules/assignments \
        backend/src/toptrainers_api/modules/programs/service.py \
        backend/tests/test_program_cancellation_integration.py \
        backend/tests/test_program_assignment_concurrency.py
git commit -m "feat: cancel issued training programs safely"
```

---

### Task 7: Prove Edit-vs-Assign atomic schedule versioning and Relationship termination compatibility

**Files:**
- Modify: `backend/tests/test_program_assignment_concurrency.py`
- Create: `backend/tests/test_training_program_relationship_termination.py`
- Modify only if a defect is proven: `backend/src/toptrainers_api/modules/programs/service.py`
- Modify only if a defect is proven: `backend/src/toptrainers_api/modules/clients/service.py`

**Interfaces:**
- Relies on Program `FOR UPDATE` as Edit/Assign serialization point.
- Relies on existing `clients.service.terminate_relationship()` ordinary child cancellation semantics; no parent status sync is added.

- [ ] **Step 1: Write deterministic Edit-vs-Assign race test**

Construct old schedule A and replacement schedule B with different slot coordinates/Workout IDs. Gate two transactions around the same Program row lock.

Assert issuance snapshot/children is exactly one of:

```text
all schedule A
all schedule B
```

and explicitly assert no mixed set of slot IDs/Workout IDs/dates.

- [ ] **Step 2: Write Relationship termination integration tests**

Cover:

```text
termination cancels Program-derived PLANNED child using existing assignment path
termination leaves Program-derived IN_PROGRESS child completable
completed child remains in History
ProgramAssignment parent status remains ACTIVE unless explicitly cancelled
```

- [ ] **Step 3: Run RED/GREEN**

```bash
pytest backend/tests/test_program_assignment_concurrency.py \
       backend/tests/test_training_program_relationship_termination.py -q
```

Expected: PASS with existing locking architecture. If a failure occurs, fix only the proven locking/termination integration defect; do not introduce parent sync.

- [ ] **Step 4: Commit Task 7**

```bash
git add backend/tests/test_program_assignment_concurrency.py \
        backend/tests/test_training_program_relationship_termination.py \
        backend/src/toptrainers_api/modules/programs/service.py \
        backend/src/toptrainers_api/modules/clients/service.py
git commit -m "test: verify program lifecycle concurrency"
```

Do not stage unchanged service files.

---

### Task 8: Add ProgramAssignment HTTP surface and verify existing Results/History integration

**Files:**
- Modify: `backend/src/toptrainers_api/modules/programs/router.py`
- Modify: `backend/src/toptrainers_api/app/router.py` only if a second router instance is required for `/program-assignments`; prefer one programs module router composition.
- Modify: `backend/tests/test_training_programs_http_contract.py`
- Create: `backend/tests/test_program_core_integration.py`
- Generated: `backend/openapi/openapi.json`

**Interfaces:**
- Exact endpoints:

```text
POST /api/v1/programs/{program_id}/assignments
operationId: createProgramAssignment

GET /api/v1/program-assignments/{program_assignment_id}
operationId: getProgramAssignment

POST /api/v1/program-assignments/{program_assignment_id}/cancel
operationId: cancelProgramAssignment
```

- Existing Program operations retain operation IDs from Task 2.

- [ ] **Step 1: Extend RED HTTP/OpenAPI tests**

Assert:

```text
trainer-only Program create/update/assign/cancel
party read of historical ProgramAssignment
foreign/non-party parent hidden/rejected consistently
exact operation IDs
Program DTO contains duration_weeks and no weeks
ProgramAssignment snapshot schema v1 shape
child summaries do not embed full workout_snapshot
existing WorkoutAssignmentResponse remains unchanged
```

- [ ] **Step 2: Run RED**

```bash
pytest backend/tests/test_training_programs_http_contract.py -q
```

Expected: parent routes/operation IDs absent.

- [ ] **Step 3: Implement HTTP handlers**

Use current module conventions and `BusinessRuleError` conversion. Do not add Program-specific branches to existing Assignment router.

- [ ] **Step 4: Write end-to-end core integration test**

One Program-derived child must traverse the existing core unchanged:

```text
create Program
→ assign Program
→ child Start
→ Results PUT
→ Complete
→ Trainer reads Results
→ completed child appears in existing Workout History
```

Also assert Direct Assignment still works in the same migrated schema with NULL provenance.

- [ ] **Step 5: Run core integration GREEN**

```bash
pytest backend/tests/test_program_core_integration.py \
       backend/tests/test_workout_results_integration.py \
       backend/tests/test_workout_history_integration.py \
       backend/tests/test_assignments_integration.py -q
```

Expected: PASS with no Program-aware changes required in Results/History production code.

- [ ] **Step 6: Generate authoritative OpenAPI**

From `backend/`:

```bash
python scripts/export_openapi.py
```

Never hand-edit the JSON.

- [ ] **Step 7: Run OpenAPI contract GREEN**

```bash
pytest backend/tests/test_training_programs_http_contract.py backend/tests/test_openapi_export.py -q
```

Expected: PASS and checked-in OpenAPI matches FastAPI output.

- [ ] **Step 8: Commit Task 8**

```bash
git add backend/src/toptrainers_api/modules/programs/router.py \
        backend/src/toptrainers_api/app/router.py \
        backend/tests/test_training_programs_http_contract.py \
        backend/tests/test_program_core_integration.py \
        backend/openapi/openapi.json
git commit -m "feat: expose training program assignment API"
```

Do not stage `app/router.py` if unchanged.

---

### Task 9: Documentation checkpoint, full regression verification and Draft PR handoff

**Files:**
- Already designed: `DOC/specs/2026-09-06-training-programs-v1-design.md`
- Already numbered: `DOC/DECISIONS.md` with ADR-015 and ADR-016
- Existing plan: `DOC/plans/2026-09-07-training-programs-v1.md`
- Modify at completion: `DOC/PROJECT_MEMORY.md`
- Modify if roadmap status is materially advanced: `DOC/ROADMAP.md`

**Interfaces:** none; this is the release-quality gate.

- [ ] **Step 1: Update project memory with factual completed capability only**

Record:

```text
Training Programs v1 implemented
migration 20260906_0010
mutable Program + full schedule replacement
immutable ProgramAssignment + atomic child issuance
parent request_id idempotency
Program cancellation PLANNED-only
existing Execution/Results/History reused unchanged
```

Do not claim production release before merge/deploy verification.

- [ ] **Step 2: Run full backend quality gates**

From `backend/`:

```bash
ruff check .
mypy src
pytest
python scripts/export_openapi.py
git diff --exit-code -- openapi/openapi.json
```

Expected: all success; PostgreSQL test suite has zero failures.

- [ ] **Step 3: Run frontend regression gates**

From `frontend/`:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all success. No frontend feature work is part of this PR.

- [ ] **Step 4: Verify migration and diff constraints**

Confirm all of the following manually from final diff:

```text
migration is additive
no backfill
program_slot_id has no FK to live program_slots
only program_assignment_id child lookup index added
no Program-specific changes in Results/History business logic
no Program Sync/background scheduler
no direct Assignment API semantic change
no unrelated infra/frontend files
no temporary diagnostic workflows
```

- [ ] **Step 5: Verify exact critical test checklist from spec**

Map each spec requirement to a passing test:

```text
empty Program saves
empty Program assign rejected
duplicate week/day rejected
slot beyond duration rejected
foreign Trainer Workout rejected
exact child issuance count
week-boundary scheduled_date mapping
child snapshots frozen
Program edit leaves issuance unchanged
Workout edit leaves child unchanged
all-or-nothing rollback
parent retry no duplicates
request_id command conflict 409
Edit vs Assign all-old/all-new
child reschedule sibling isolation
child cancel sibling isolation
Program cancellation PLANNED-only
Cancel vs Start race
Relationship termination existing semantics
Direct Assignment unchanged
Program-derived completed child in existing History/Results
```

- [ ] **Step 6: Create/refresh Draft PR from feature branch**

PR body must include:

```text
base SHA
exact head SHA
migration revision
architectural summary
TDD RED/GREEN evidence
full CI run number
exact pytest pass count
known non-blocking warnings only
explicit statement: no merge/deploy performed
```

- [ ] **Step 7: Keep PR Draft and hand off to QA**

Prepare `HANDOFF → 07 QA / Technical Auditor` asking for critical path, permissions, idempotency, frozen snapshots, migration, concurrency, Program cancellation races, Direct Assignment regression and History/Results integration. Do not merge from Backend without owner/PM decision.
