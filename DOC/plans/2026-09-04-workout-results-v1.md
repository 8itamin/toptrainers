# Workout Results v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add validated, correction-friendly actual reps/weight per frozen Assignment planned set, scoped to singleton Execution and exposed through authoritative FastAPI OpenAPI.

**Architecture:** Results remain inside the existing `assignments` module as child resources of `WorkoutExecution`. Identity is the frozen positional coordinate `(block_position, exercise_position, set_index)`, mutations use the existing `Account → Relationship → Assignment → Execution` lock order plus PostgreSQL upsert, and reads never consult the current Workout template.

**Tech Stack:** Python 3.13, FastAPI, SQLAlchemy 2 async, PostgreSQL 17, Alembic, Pydantic v2, pytest/pytest-asyncio, Ruff, mypy.

**Spec:** `DOC/specs/2026-09-04-workout-results-v1-design.md`

## Global Constraints

- Baseline: `main@74eb52d5bbab14d8f6bfa12d4146d03e4291b55a`.
- Migration: `20260904_0009`, additive, down revision `20260904_0008`.
- No Program, analytics, offline/realtime, result revisions, request IDs, lifecycle changes or History payload changes.
- `source_exercise_id` MUST NOT participate in Result identity.
- Current Workout/Exercise tables MUST NOT be used for result mapping.
- Trainer mutation is forbidden; Client correction after completion/termination is allowed.
- OpenAPI generated from FastAPI is authoritative.

---

### Task 1: Persistence and request/response contracts

**Files:**
- Modify: `backend/src/toptrainers_api/modules/assignments/models.py`
- Modify: `backend/src/toptrainers_api/modules/assignments/schemas.py`
- Create: `backend/migrations/versions/20260904_0009_workout_results_v1.py`
- Test: `backend/tests/test_workout_results_model_contract.py`
- Modify: `backend/tests/test_p0_alembic_roundtrip.py`

**Interfaces:**
- Produces ORM `WorkoutExecutionSetResult` and Pydantic `WorkoutExecutionSetResultUpsertRequest`, `WorkoutExecutionSetResultResponse`.
- Composite PK is `(execution_id, block_position, exercise_position, set_index)`.

- [ ] **Step 1: Write failing model/schema tests**

```python
def test_result_model_uses_coordinate_primary_key_and_db_checks() -> None:
    table = WorkoutExecutionSetResult.__table__
    assert [column.name for column in table.primary_key.columns] == [
        "execution_id", "block_position", "exercise_position", "set_index"
    ]
    assert "source_exercise_id" not in table.columns


def test_result_request_requires_at_least_one_actual() -> None:
    with pytest.raises(ValidationError):
        WorkoutExecutionSetResultUpsertRequest(actual_reps=None, actual_weight_kg=None)
    assert WorkoutExecutionSetResultUpsertRequest(actual_reps=0).actual_reps == 0
```

- [ ] **Step 2: Run RED**

Run: `pytest backend/tests/test_workout_results_model_contract.py -q`
Expected: import/attribute failures because Results model/schemas do not exist.

- [ ] **Step 3: Implement minimal ORM/schema/migration**

```python
class WorkoutExecutionSetResult(Base):
    __tablename__ = "workout_execution_set_results"
    execution_id: Mapped[str] = mapped_column(ForeignKey("workout_executions.id"), primary_key=True)
    block_position: Mapped[int] = mapped_column(Integer, primary_key=True)
    exercise_position: Mapped[int] = mapped_column(Integer, primary_key=True)
    set_index: Mapped[int] = mapped_column(Integer, primary_key=True)
    actual_reps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actual_weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
```

Add exact DB checks from the spec and Pydantic field bounds/model validation.

- [ ] **Step 4: Extend Alembic roundtrip**

Verify `0008 → 0009 → 0008 → 0009/head`, table presence and no unexpected extra index beyond PK.

- [ ] **Step 5: Run GREEN**

Run: `pytest backend/tests/test_workout_results_model_contract.py backend/tests/test_p0_alembic_roundtrip.py -q`
Expected: PASS on PostgreSQL CI; local non-PostgreSQL collection may skip database roundtrip.

---

### Task 2: Frozen coordinate validation and repository upsert/delete/list

**Files:**
- Create: `backend/src/toptrainers_api/modules/assignments/results_repository.py`
- Create: `backend/src/toptrainers_api/modules/assignments/results_service.py`
- Test: `backend/tests/test_workout_results_domain.py`

**Interfaces:**
- Produces `validate_result_coordinate(snapshot, block_position, exercise_position, set_index) -> None`.
- Produces repository functions `list_for_execution`, `upsert`, `delete`.

- [ ] **Step 1: Write RED tests for positional identity**

```python
def test_duplicate_source_exercise_occurrences_are_independent() -> None:
    snapshot = snapshot_with_same_source_exercise_at_positions_zero_and_one()
    validate_result_coordinate(snapshot, 0, 0, 0)
    validate_result_coordinate(snapshot, 0, 1, 0)

@pytest.mark.parametrize("coords", [(99, 0, 0), (0, 99, 0), (0, 0, 99)])
def test_invalid_frozen_coordinate_is_rejected(coords: tuple[int, int, int]) -> None:
    with pytest.raises(ResultCoordinateNotFound):
        validate_result_coordinate(snapshot_fixture(), *coords)
```

- [ ] **Step 2: Run RED**

Run: `pytest backend/tests/test_workout_results_domain.py -q`
Expected: missing Results service/repository.

- [ ] **Step 3: Implement snapshot-only validation**

Use `WorkoutSnapshotV1.model_validate(assignment.workout_snapshot)` and select by stored `position`; never query `workouts` or `exercises`.

- [ ] **Step 4: Implement PostgreSQL upsert**

```python
stmt = pg_insert(WorkoutExecutionSetResult).values(...)
stmt = stmt.on_conflict_do_update(
    index_elements=["execution_id", "block_position", "exercise_position", "set_index"],
    set_={
        "actual_reps": stmt.excluded.actual_reps,
        "actual_weight_kg": stmt.excluded.actual_weight_kg,
    },
)
```

List order: block/exercise/set ascending. Delete returns no distinction between missing/existing row.

- [ ] **Step 5: Run GREEN**

Run: `pytest backend/tests/test_workout_results_domain.py -q`
Expected: PASS.

---

### Task 3: Client mutation/read and Trainer historical read authorization

**Files:**
- Modify: `backend/src/toptrainers_api/modules/assignments/results_service.py`
- Test: `backend/tests/test_workout_results_integration.py`

**Interfaces:**
- Produces `list_results(session, actor_id, actor_role, assignment_id)`.
- Produces `put_result(session, client_id, assignment_id, coordinates, payload)`.
- Produces `delete_result(session, client_id, assignment_id, coordinates)`.

- [ ] **Step 1: Write RED integration tests**

Cover first save, reps-only, weight-only, reps=0, IN_PROGRESS correction, COMPLETED correction, terminated Relationship correction, completion with zero Results, Trainer historical completed read, Trainer mutation forbidden, foreign Trainer/Client hidden, current Workout mutation independence.

- [ ] **Step 2: Run RED on PostgreSQL**

Run: `pytest backend/tests/test_workout_results_integration.py -q`
Expected: failures because service methods are absent.

- [ ] **Step 3: Implement parent context/authorization**

Mutation lock sequence:

```text
relationship_id scalar
→ clients_service.lock_relationship_with_client()  # Account then Relationship
→ repository.lock_assignment()
→ repository.lock_execution_by_assignment()
→ snapshot coordinate validation
→ result upsert/delete
→ commit
```

Do not require ACTIVE Relationship. Require Assignment `IN_PROGRESS|COMPLETED` and existing Execution.

Read rules:

- Client: own Relationship + Assignment `IN_PROGRESS|COMPLETED` + Execution.
- Trainer: own Relationship + Assignment `COMPLETED` + `execution.completed_at is not None`.
- Outsiders: `404 ASSIGNMENT_NOT_FOUND`.

- [ ] **Step 4: Run GREEN**

Run: `pytest backend/tests/test_workout_results_integration.py -q`
Expected: PASS.

---

### Task 4: Concurrency and natural-key idempotency

**Files:**
- Test: `backend/tests/test_workout_results_concurrency.py`
- Modify if required: `backend/src/toptrainers_api/modules/assignments/results_service.py`
- Modify if required: `backend/src/toptrainers_api/modules/assignments/results_repository.py`

**Interfaces:**
- Relies on Execution `FOR UPDATE` as serialization point and DB composite PK/upsert as invariant backstop.

- [ ] **Step 1: Write deterministic RED race tests**

Cases:

```text
concurrent first PUT same coordinate → exactly one row
repeated identical PUT → one row and same values
correction A waits, correction B commits after A → final values == B
```

Use held parent/Execution locks to order contenders deterministically; do not rely only on sleeps.

- [ ] **Step 2: Run RED/GREEN**

Run: `pytest backend/tests/test_workout_results_concurrency.py -q`
Expected: PASS after repository/service implementation; if a race fails, fix locking/upsert rather than weakening assertions.

---

### Task 5: HTTP/OpenAPI surface

**Files:**
- Modify: `backend/src/toptrainers_api/modules/assignments/router.py`
- Test: `backend/tests/test_workout_results_http_contract.py`
- Generated: `backend/openapi/openapi.json`

**Interfaces:**
- `GET /assignments/{assignment_id}/execution/results`
- `PUT /assignments/{assignment_id}/execution/results/{block_position}/{exercise_position}/{set_index}`
- `DELETE` same resource path.

- [ ] **Step 1: Write RED HTTP/OpenAPI tests**

Assert exact operation IDs, body schema, response schema, path coordinate minimum `0`, Trainer mutation `403`, repeated DELETE `204`, and Results absent from Workout History item schema.

- [ ] **Step 2: Run RED**

Run: `pytest backend/tests/test_workout_results_http_contract.py -q`
Expected: missing paths/operation IDs.

- [ ] **Step 3: Add router handlers**

```text
listWorkoutExecutionResults
putWorkoutExecutionSetResult
deleteWorkoutExecutionSetResult
```

PUT returns 200; DELETE returns 204. Router enforces Client-only mutation before service execution.

- [ ] **Step 4: Generate authoritative OpenAPI**

Run from `backend/`: `python scripts/export_openapi.py`

- [ ] **Step 5: Run GREEN**

Run: `pytest backend/tests/test_workout_results_http_contract.py -q`
Expected: PASS and checked-in OpenAPI drift test remains green.

---

### Task 6: Documentation and full release verification

**Files:**
- Modify: `DOC/DECISIONS.md` with accepted ADR-015 for Results v1
- Modify: `DOC/PROJECT_MEMORY.md` with completed capability checkpoint

**Interfaces:** none.

- [ ] **Step 1: Record only accepted architecture**

ADR-015 must capture positional frozen-snapshot identity, execution-owned set results, Client-only mutation, Trainer completed historical read, correction after completion/termination, natural-key upsert and unchanged lifecycle/history.

- [ ] **Step 2: Run full backend gates**

```bash
cd backend
ruff check .
mypy src
pytest
python scripts/export_openapi.py
git diff --exit-code -- openapi/openapi.json
```

Expected: all success; PostgreSQL suite has zero failures.

- [ ] **Step 3: Run frontend regression gates**

```bash
cd frontend
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all success.

- [ ] **Step 4: Review final diff**

Confirm migration is additive, no extra indexes, no History API change, no current Workout dependency, no temporary CI workflow and no unrelated files.

- [ ] **Step 5: Keep PR Draft for QA**

Update PR body with exact final head and CI run evidence; do not merge without QA/owner decision.
