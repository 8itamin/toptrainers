# Training Programs v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Evolve Program into a mutable schedule and issue immutable parents with existing frozen child assignments.

**Architecture:** Programs owns Program, ProgramSlot and ProgramAssignment. Assignments exposes a commit-free child materializer; direct assignments remain unchanged. Program operations lock Relationship → Program → ProgramAssignment → WorkoutAssignment.

**Tech Stack:** Python 3.13, FastAPI, Pydantic v2, SQLAlchemy async, PostgreSQL JSONB, Alembic, pytest.

**Spec:** docs/superpowers/specs/2026-09-07-training-programs-v1-design.md

## Global Constraints

- duration_weeks is the sole public field and maps to physical programs.weeks.
- Empty program save is valid; empty issuance returns 409.
- Slots are unique by (program_id, week_number, day_number), use owned Workouts, have week 1–duration and day 1–7.
- A child date is start_date + (week_number - 1) * 7 + (day_number - 1).
- Issuance has one transaction and one commit. Parent request id is relationship-scoped and retries return the original parent.
- Parent cancellation changes only PLANNED children. Existing child lifecycle, Results, History and relationship-termination behavior are unchanged.
- Downgrading 20260906_0010 after issuance deletes program-assignment data and is not a production rollback.

---

### Task 1: Add persistent schedule and provenance

**Files:**
- Modify: backend/src/toptrainers_api/modules/programs/models.py
- Modify: backend/src/toptrainers_api/modules/assignments/models.py
- Modify: backend/migrations/env.py
- Create: backend/migrations/versions/20260906_0010_training_programs_v1.py
- Create: backend/tests/test_training_programs_model_contract.py
- Create: backend/tests/test_training_programs_migration.py

**Interfaces:**
- Program.duration_weeks maps to column weeks.
- ProgramSlot and ProgramAssignment own schedule and parent issuance data.
- WorkoutAssignment gets nullable program_assignment_id and program_slot_id.

- [ ] **Step 1: Write failing schema tests**

~~~python
def test_slot_constraints_and_parent_request_constraint() -> None:
    ddl = str(CreateTable(ProgramSlot.__table__).compile(dialect=postgresql.dialect()))
    parent_ddl = str(CreateTable(ProgramAssignment.__table__).compile(dialect=postgresql.dialect()))
    assert "uq_program_slots_program_week_day" in ddl
    assert "week_number >= 1" in ddl
    assert "day_number <= 7" in ddl
    assert "uq_program_assignments_relationship_request_id" in parent_ddl
~~~

- [ ] **Step 2: Verify red**

Run: pytest tests/test_training_programs_model_contract.py tests/test_training_programs_migration.py -v

Expected: FAIL because the models and revision do not exist.

- [ ] **Step 3: Implement additive revision and model mappings**

~~~python
class Program(Base):
    duration_weeks: Mapped[int] = mapped_column("weeks", Integer, default=1)

class ProgramSlot(Base):
    __tablename__ = "program_slots"
    __table_args__ = (UniqueConstraint("program_id", "week_number", "day_number",
                                      name="uq_program_slots_program_week_day"),)
~~~

Revision 20260906_0010_training_programs_v1 follows 20260904_0009, creates program_slots and program_assignments, and adds nullable provenance FKs/indexes to workout_assignments.

- [ ] **Step 4: Verify green**

Run: pytest tests/test_training_programs_model_contract.py tests/test_training_programs_migration.py -v

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add backend/src/toptrainers_api/modules/programs/models.py backend/src/toptrainers_api/modules/assignments/models.py backend/migrations/env.py backend/migrations/versions/20260906_0010_training_programs_v1.py backend/tests/test_training_programs_model_contract.py backend/tests/test_training_programs_migration.py
git commit -m "feat: add training program persistence"
~~~

### Task 2: Implement canonical Program schedule API

**Files:**
- Modify: backend/src/toptrainers_api/modules/programs/schemas.py
- Create: backend/src/toptrainers_api/modules/programs/repository.py
- Create: backend/src/toptrainers_api/modules/programs/service.py
- Modify: backend/src/toptrainers_api/modules/programs/router.py
- Create: backend/tests/test_training_programs_integration.py
- Create: backend/tests/test_training_programs_http_contract.py

**Interfaces:**
- ProgramWriteRequest(title, description, duration_weeks, slots).
- replace_program(session, trainer_id, program_id, payload) -> Program.
- POST /programs, GET /programs, PUT /programs/{program_id}.

- [ ] **Step 1: Write failing contract tests**

~~~python
async def test_empty_program_uses_duration_weeks(client) -> None:
    response = await client.post("/api/v1/programs", json={
        "title": "Base", "description": "", "duration_weeks": 2, "slots": []})
    assert response.status_code == 201
    assert response.json()["duration_weeks"] == 2
    assert "weeks" not in response.json()

async def test_schedule_rejects_invalid_slots(...) -> None:
    assert (await create_duplicate_coordinate()).status_code == 422
    assert (await create_week_beyond_duration()).status_code == 422
    assert (await create_foreign_workout()).status_code == 422
~~~

- [ ] **Step 2: Verify red**

Run: pytest tests/test_training_programs_integration.py tests/test_training_programs_http_contract.py -v

Expected: FAIL because current Program has no slots or update.

- [ ] **Step 3: Implement full replacement under Program lock**

~~~python
async def replace_program(...) -> Program:
    program = await repository.lock_owned_program(session, trainer_id, program_id)
    validate_slot_coordinates(payload.duration_weeks, payload.slots)
    await require_owned_workouts(session, trainer_id, {slot.workout_id for slot in payload.slots})
    program.title, program.description, program.duration_weeks = (
        payload.title, payload.description, payload.duration_weeks)
    program.slots[:] = [ProgramSlot(id=str(uuid4()), **slot.model_dump()) for slot in payload.slots]
    await session.commit()
    return await repository.get_owned_program(session, trainer_id, program_id)
~~~

- [ ] **Step 4: Verify green**

Run: pytest tests/test_training_programs_integration.py tests/test_training_programs_http_contract.py -v

Expected: PASS for empty save, full replacement, duplicate, out-of-range and foreign-Workout cases.

- [ ] **Step 5: Commit**

~~~bash
git add backend/src/toptrainers_api/modules/programs backend/tests/test_training_programs_integration.py backend/tests/test_training_programs_http_contract.py
git commit -m "feat: manage training program schedules"
~~~

### Task 3: Extract a no-commit child materializer

**Files:**
- Modify: backend/src/toptrainers_api/modules/assignments/service.py
- Modify: backend/tests/test_assignments_integration.py
- Modify: backend/tests/test_assignments_concurrency.py

**Interfaces:**
- materialize_assignment(session, relationship, trainer_id, workout_id, request_id, scheduled_date, program_assignment_id=None, program_slot_id=None) -> WorkoutAssignment.
- It snapshots an owned Workout and adds the child; it never commits, refreshes or rolls back.
- create_assignment keeps direct request-id handling and passes null provenance.

- [ ] **Step 1: Write failing direct-regression tests**

~~~python
async def test_direct_assignment_has_null_program_provenance(...) -> None:
    result = await create_assignment(session, TRAINER_ID, create_payload())
    assert result.assignment.program_assignment_id is None
    assert result.assignment.program_slot_id is None

async def test_materializer_does_not_commit(...) -> None:
    row = await materialize_assignment(session, relationship, TRAINER_ID, WORKOUT_ID,
                                       "internal", date(2026, 9, 7))
    await session.rollback()
    assert await fresh_session.get(WorkoutAssignment, row.id) is None
~~~

- [ ] **Step 2: Verify red**

Run: pytest tests/test_assignments_integration.py tests/test_assignments_concurrency.py -v

Expected: FAIL because the materializer is absent.

- [ ] **Step 3: Refactor materialization only**

Move owned Workout/exercise validation, frozen snapshot creation and child construction out of create_assignment. Keep existing direct commit, conflict and integrity-race recovery in create_assignment.

- [ ] **Step 4: Verify green**

Run: pytest tests/test_assignments_domain.py tests/test_assignments_integration.py tests/test_assignments_concurrency.py tests/test_assignments_http_contract.py -v

Expected: PASS with an unchanged direct API.

- [ ] **Step 5: Commit**

~~~bash
git add backend/src/toptrainers_api/modules/assignments/service.py backend/tests/test_assignments_integration.py backend/tests/test_assignments_concurrency.py
git commit -m "refactor: extract assignment materializer"
~~~

### Task 4: Atomically issue ProgramAssignments

**Files:**
- Modify: backend/src/toptrainers_api/modules/programs/schemas.py
- Modify: backend/src/toptrainers_api/modules/programs/repository.py
- Modify: backend/src/toptrainers_api/modules/programs/service.py
- Modify: backend/src/toptrainers_api/modules/programs/router.py
- Create: backend/tests/test_training_program_assignments_integration.py
- Create: backend/tests/test_training_program_assignments_concurrency.py
- Modify: backend/tests/test_training_programs_http_contract.py

**Interfaces:**
- IssueProgramRequest(client_id, start_date, request_id).
- issue_program(session, trainer_id, program_id, payload) -> ProgramAssignmentResult.
- POST /programs/{program_id}/assignments.

- [ ] **Step 1: Write failing atomic/idempotency tests**

~~~python
async def test_issue_creates_exact_children_and_dates(...) -> None:
    result = await issue_program(session, TRAINER_ID, PROGRAM_ID,
        IssueProgramRequest(client_id=CLIENT_ID, start_date=date(2026, 9, 7), request_id="p1"))
    assert len(result.child_assignments) == 3
    assert [row.scheduled_date for row in result.child_assignments] == [
        date(2026, 9, 7), date(2026, 9, 14), date(2026, 9, 16)]

async def test_same_request_returns_original_after_edit(...) -> None:
    first = await issue_program(..., request_id="retry")
    await replace_program(..., changed_schedule)
    second = await issue_program(..., request_id="retry")
    assert second.parent.id == first.parent.id
    assert second.parent.program_snapshot == first.parent.program_snapshot
~~~

Cover empty 409, different command 409, slot-N failure rolls back parent and all children, frozen child after Workout edit, unchanged issuance after Program edit and Edit-vs-Assign old-or-new schedule serialization.

- [ ] **Step 2: Verify red**

Run: pytest tests/test_training_program_assignments_integration.py tests/test_training_program_assignments_concurrency.py -v

Expected: FAIL because issuance is absent.

- [ ] **Step 3: Implement one-commit issuance**

~~~python
async def issue_program(...) -> ProgramAssignmentResult:
    relationship = await lock_active_relationship_for_trainer_client(...)
    program = await repository.lock_owned_program(session, trainer_id, program_id)
    existing = await repository.get_parent_by_request_id(session, relationship.id, payload.request_id)
    if existing is not None:
        require_matching_command(existing, program_id, payload)
        return await load_parent_result(session, existing)
    require_non_empty(program.slots)
    parent = ProgramAssignment(id=str(uuid4()), program_snapshot=build_program_snapshot_v1(program), ...)
    session.add(parent)
    for slot in program.slots:
        await materialize_assignment(session, relationship, trainer_id, slot.workout_id,
            child_request_id(parent.id, slot.id), scheduled_date(payload.start_date, slot),
            program_assignment_id=parent.id, program_slot_id=slot.id)
    await session.commit()
    return await load_parent_result(session, parent)
~~~

The schema-v1 parent snapshot stores only Program metadata, duration and slot coordinates/Workout IDs. It never stores Workout content. Recover only matching parent unique-constraint races.

- [ ] **Step 4: Verify green**

Run: pytest tests/test_training_program_assignments_integration.py tests/test_training_program_assignments_concurrency.py tests/test_training_programs_integration.py -v

Expected: PASS; concurrent edit/assign sees no mixed schedule.

- [ ] **Step 5: Commit**

~~~bash
git add backend/src/toptrainers_api/modules/programs backend/tests/test_training_program_assignments_integration.py backend/tests/test_training_program_assignments_concurrency.py backend/tests/test_training_programs_http_contract.py
git commit -m "feat: issue training program assignments"
~~~

### Task 5: Cancel only PLANNED child assignments

**Files:**
- Modify: backend/src/toptrainers_api/modules/programs/models.py
- Modify: backend/src/toptrainers_api/modules/programs/repository.py
- Modify: backend/src/toptrainers_api/modules/programs/service.py
- Modify: backend/src/toptrainers_api/modules/programs/router.py
- Modify: backend/tests/test_training_program_assignments_integration.py
- Modify: backend/tests/test_training_program_assignments_concurrency.py
- Modify: backend/tests/test_assignments_read_side.py
- Modify: backend/tests/test_workout_history_integration.py
- Modify: backend/tests/test_workout_results_integration.py

**Interfaces:**
- cancel_program_assignment(session, trainer_id, parent_id) -> ProgramAssignmentResult.
- POST /program-assignments/{parent_id}/cancel.

- [ ] **Step 1: Write failing cancellation compatibility tests**

~~~python
async def test_parent_cancel_only_changes_planned_children(...) -> None:
    parent = await issue_program(...)
    await start_execution(session, CLIENT_ID, parent.child_assignments[1].id)
    result = await cancel_program_assignment(session, TRAINER_ID, parent.parent.id)
    assert statuses(result.child_assignments) == ["CANCELLED", "IN_PROGRESS", "CANCELLED"]

async def test_cancel_racing_start_has_consistent_child_state(...) -> None:
    await asyncio.gather(cancel_parent(), start_child())
    assert await final_status(child_id) in {"CANCELLED", "IN_PROGRESS"}
~~~

Also prove child reschedule/cancel does not affect siblings, Program-derived completed children appear in current History/Results and relationship termination remains unchanged.

- [ ] **Step 2: Verify red**

Run: pytest tests/test_training_program_assignments_integration.py tests/test_training_program_assignments_concurrency.py -v

Expected: FAIL because parent cancellation is absent.

- [ ] **Step 3: Implement cancellation under established locks**

~~~python
async def cancel_program_assignment(...) -> ProgramAssignmentResult:
    relationship = await lock_relationship_with_client(session, parent.relationship_id)
    require_parent_trainer(relationship, trainer_id)
    parent = await repository.lock_parent(session, parent_id)
    if parent.status == "ISSUED":
        await repository.cancel_planned_children(session, parent.id)
        parent.status = "CANCELLED"
        await session.commit()
    return await load_parent_result(session, parent)
~~~

The update filters program_assignment_id and PLANNED. Do not change existing child lifecycle endpoints.

- [ ] **Step 4: Verify green**

Run: pytest tests/test_training_program_assignments_integration.py tests/test_training_program_assignments_concurrency.py tests/test_assignments_read_side.py tests/test_workout_history_integration.py tests/test_workout_results_integration.py -v

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add backend/src/toptrainers_api/modules/programs backend/tests/test_training_program_assignments_integration.py backend/tests/test_training_program_assignments_concurrency.py backend/tests/test_assignments_read_side.py backend/tests/test_workout_history_integration.py backend/tests/test_workout_results_integration.py
git commit -m "feat: cancel training program assignments"
~~~

### Task 6: Verify migrations, OpenAPI and project record

**Files:**
- Modify: backend/tests/test_p0_migration_wiring.py
- Modify: backend/tests/test_p0_alembic_roundtrip.py
- Modify: DOC/PROJECT_MEMORY.md
- Modify: DOC/DECISIONS.md

- [ ] **Step 1: Write migration-head assertion**

~~~python
def test_training_program_migration_follows_results() -> None:
    source = (ROOT / "migrations/versions/20260906_0010_training_programs_v1.py").read_text()
    assert 'down_revision = "20260904_0009"' in source
    assert '"program_slots"' in source
    assert '"program_assignments"' in source
~~~

- [ ] **Step 2: Verify migration lifecycle**

Run: pytest tests/test_p0_migration_wiring.py tests/test_p0_alembic_roundtrip.py -v

Expected: PASS for upgrade, downgrade and re-upgrade; document destructive downgrade.

- [ ] **Step 3: Update durable record**

Add delivered behavior, migration, lock order and destructive downgrade warning to DOC/PROJECT_MEMORY.md. Keep ADR-015 aligned with the implementation.

- [ ] **Step 4: Run full verification**

Run: pytest -q

Expected: full backend suite passes with TT_TEST_DATABASE_URL.

Run: ruff check src tests && mypy src

Expected: both commands exit 0.

Run the repository documented OpenAPI drift check.

Expected: no contract drift.

- [ ] **Step 5: Commit**

~~~bash
git add backend/tests/test_p0_migration_wiring.py backend/tests/test_p0_alembic_roundtrip.py DOC/PROJECT_MEMORY.md DOC/DECISIONS.md docs/superpowers/specs/2026-09-07-training-programs-v1-design.md docs/superpowers/plans/2026-09-07-training-programs-v1.md
git commit -m "docs: record training programs v1"
~~~

## Plan self-review

- Spec coverage: Tasks 1–2 implement schedule persistence and canonical API; Task 3 preserves direct semantics; Task 4 implements atomic issuance, snapshots, dates, idempotency and edit race safety; Task 5 covers cancellation and existing downstream behavior; Task 6 covers migration lifecycle, static checks, OpenAPI and documents.
- Placeholder scan: no implementation placeholders remain.
- Type consistency: ProgramSlot, ProgramAssignment, materialize_assignment, IssueProgramRequest, issue_program and cancel_program_assignment are defined before use.
