# Program Tasks and S3 Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver typed program/workout tasks with append-only client results and private S3 images.

**Architecture:** A new `tasks` module owns templates, issued task assignments, result versions, and media ownership. Programs gain ordered polymorphic schedule items; workouts gain ordered task steps. Existing assignment services materialize frozen task assignments atomically, and Angular replaces the new library/task mock arrays with generated OpenAPI-backed state.

**Tech Stack:** Python 3.13, FastAPI, SQLAlchemy 2 async, PostgreSQL 17, Alembic, boto3, Angular 21, RxJS, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-22-program-tasks-and-s3-media-design.md`

## Global Constraints

- `TaskTemplate` contains only typed fields `completion`, `measurement`, `photo`, and `note`; no arbitrary HTML or form schemas.
- S3 is private; credentials stay in untracked environment configuration and object keys never enter normal API responses.
- Allowed images are JPEG, PNG, and WebP with a 10 MiB maximum.
- Tasks never affect workout execution or set-result lifecycle.
- Issued task/template/workout/program snapshots are immutable; corrections append a result version.
- Mutations require an active trainer-client relationship; terminated relationships retain read-only history.
- FastAPI OpenAPI is authoritative; Angular contracts are generated, never duplicated manually.
- All schema changes are forward data-preserving; production release follows the existing pre-migration backup gate.

## Review Focus

- A program day containing a workout and two standalone tasks must materialize all three items in their positions.
- A trainer cannot replace a task template after assignment and change what an existing client must submit.
- Two simultaneous result submissions must receive different consecutive versions; a retried `request_id` must not create another version.
- A client cannot attach another task's uploaded object, a foreign object, a non-image, or a file over 10 MiB.
- Completing a workout while its nested task is pending must leave both lifecycle states valid and independent.

---

### Task 1: Task persistence, typed schemas, and migration

**Files:**
- Create: `backend/src/toptrainers_api/modules/tasks/{__init__,models,schemas,repository,service,router}.py`
- Create: `backend/migrations/versions/20260922_0011_program_tasks.py`
- Modify: `backend/src/toptrainers_api/app/router.py`
- Modify: `backend/pyproject.toml`
- Test: `backend/tests/test_tasks_model_contract.py`
- Test: `backend/tests/test_tasks_migration.py`

**Interfaces:** Produces `TaskTemplate`, `TaskAssignment`, `TaskResultVersion`, `TaskMediaObject`; `TaskTemplateWrite`, `TaskAssignmentResponse`, and `SubmitTaskResultRequest`; router prefix `/tasks`.

- [ ] **Step 1: Write failing ORM/schema contract tests**

```python
def test_task_result_versions_are_append_only_per_assignment() -> None:
    table = TaskResultVersion.__table__
    assert {"assignment_id", "version"} == {column.name for column in table.primary_key.columns}
    assert "updated_at" not in table.columns

def test_task_template_requires_one_typed_result_field() -> None:
    with pytest.raises(ValidationError):
        TaskTemplateWrite(title="Замер", result_fields=[])
    assert TaskTemplateWrite(title="Бицепс", result_fields=[MeasurementField(unit="cm")])
```

- [ ] **Step 2: Run the contract tests red**

Run: `cd backend && pytest tests/test_tasks_model_contract.py -q`  
Expected: import failures because the task models and schemas do not exist.

- [ ] **Step 3: Implement typed models, schemas, and additive migration**

```python
class TaskAssignment(Base):
    __tablename__ = "task_assignments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    relationship_id: Mapped[str] = mapped_column(ForeignKey("trainer_client_relationships.id"))
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    task_snapshot: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)

class TaskResultVersion(Base):
    __tablename__ = "task_result_versions"
    assignment_id: Mapped[str] = mapped_column(ForeignKey("task_assignments.id"), primary_key=True)
    version: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[str] = mapped_column(String(128), nullable=False)
```

Use CHECK constraints for status, positive version, a unique `(assignment_id, request_id)`, and task snapshots with schema version `1`. Add `boto3>=1.35,<2` to runtime dependencies; do not make Alembic contact S3.

- [ ] **Step 4: Add migration preservation coverage**

Test `0010 -> 0011 -> 0010 -> 0011`, confirming the four task tables and constraints exist after upgrade and that no existing program/workout row is deleted.

- [ ] **Step 5: Run green tests**

Run: `cd backend && pytest tests/test_tasks_model_contract.py tests/test_tasks_migration.py -q`  
Expected: PASS against PostgreSQL.

### Task 2: Ordered program schedule and workout task templates

**Files:**
- Modify: `backend/src/toptrainers_api/modules/programs/{models,schemas,repository,service}.py`
- Modify: `backend/src/toptrainers_api/modules/workouts/{models,schemas,repository,service,router}.py`
- Modify: `backend/migrations/versions/20260922_0011_program_tasks.py`
- Test: `backend/tests/test_program_task_schedule.py`
- Test: `backend/tests/test_workout_task_templates.py`

**Interfaces:** Replaces workout-only `ProgramSlotWrite` with `ProgramScheduleItemWrite(kind, position, workout_id | task_template_id)`. Extends `WorkoutCreate`/`WorkoutResponse` with ordered `WorkoutTaskWrite`/`WorkoutTaskResponse`.

- [ ] **Step 1: Write failing domain tests for mixed placement**

```python
def test_program_accepts_workout_and_two_tasks_on_the_same_day() -> None:
    payload = ProgramCreate(duration_weeks=1, schedule_items=[
        ProgramScheduleItemWrite(week_number=1, day_number=1, position=0, kind="WORKOUT", workout_id=WORKOUT),
        ProgramScheduleItemWrite(week_number=1, day_number=1, position=1, kind="TASK", task_template_id=TASK_A),
        ProgramScheduleItemWrite(week_number=1, day_number=1, position=2, kind="TASK", task_template_id=TASK_B),
    ])
    assert len(payload.schedule_items) == 3
```

- [ ] **Step 2: Run tests red**

Run: `cd backend && pytest tests/test_program_task_schedule.py tests/test_workout_task_templates.py -q`  
Expected: FAIL because current schemas allow one workout-only slot per day and workouts have no task steps.

- [ ] **Step 3: Implement exact-one-target validation and ownership checks**

```python
if item.kind == "WORKOUT":
    require(item.workout_id is not None and item.task_template_id is None)
if item.kind == "TASK":
    require(item.task_template_id is not None and item.workout_id is None)
```

Migrate existing `program_slots` to ordered schedule items at `position=0`. Validate each referenced workout/template belongs to the trainer before save. Put workout tasks in their own `workout_tasks` table with a unique `(workout_id, position)` and preserve existing workout blocks/exercises.

- [ ] **Step 4: Run green tests**

Run: `cd backend && pytest tests/test_program_task_schedule.py tests/test_workout_task_templates.py -q`  
Expected: PASS; duplicate day/position and foreign template references return validation errors.

### Task 3: Frozen task materialization, cancellation, and version concurrency

**Files:**
- Modify: `backend/src/toptrainers_api/modules/tasks/{repository,service,schemas}.py`
- Modify: `backend/src/toptrainers_api/modules/programs/service.py`
- Modify: `backend/src/toptrainers_api/modules/assignments/{models,repository,service}.py`
- Test: `backend/tests/test_task_materialization.py`
- Test: `backend/tests/test_task_versions_concurrency.py`
- Test: `backend/tests/test_task_assignment_permissions.py`

**Interfaces:** Produces `materialize_program_task_assignments(...)`, `materialize_workout_task_assignments(...)`, `submit_result_version(...)`, and `cancel_pending_for_program_assignment(...)`.

- [ ] **Step 1: Write failing materialization and lifecycle tests**

```python
async def test_issued_program_freezes_standalone_and_workout_task_snapshots(session) -> None:
    issued = await issue_program(session, trainer_account, PROGRAM_ID, request)
    tasks = await list_task_assignments_for_program(session, issued.id)
    assert [(task.scheduled_date, task.task_snapshot["title"]) for task in tasks] == [
        (date(2026, 9, 1), "Измерить бицепс"),
        (date(2026, 9, 1), "Фото прогресса"),
    ]

async def test_completed_workout_does_not_complete_nested_task(session) -> None:
    await complete_execution(session, CLIENT_ID, WORKOUT_ASSIGNMENT_ID)
    assert (await get_task_assignment(session, NESTED_TASK_ID)).status == "PENDING"
```

- [ ] **Step 2: Run tests red**

Run: `cd backend && pytest tests/test_task_materialization.py tests/test_task_versions_concurrency.py tests/test_task_assignment_permissions.py -q`  
Expected: FAIL because no task assignments are issued and no version allocator exists.

- [ ] **Step 3: Materialize frozen snapshots in parent transactions**

On program issuance, create direct task assignments for `TASK` schedule items and let each materialized workout assignment create assignments for frozen workout task steps. On direct workout assignment, create its child task assignments in the same commit. Add provenance columns rather than changing existing execution/history payloads.

```python
assignment = await repository.lock_task_assignment(session, task_assignment_id)
next_version = await repository.next_version(session, assignment.id)
session.add(TaskResultVersion(assignment_id=assignment.id, version=next_version, ...))
```

Lock `Relationship -> ProgramAssignment/WorkoutAssignment -> TaskAssignment`; use a unique request ID constraint and recovery query for concurrent retries. Cancel only `PENDING` tasks belonging to a cancelled program assignment.

- [ ] **Step 4: Run green tests**

Run: `cd backend && pytest tests/test_task_materialization.py tests/test_task_versions_concurrency.py tests/test_task_assignment_permissions.py -q`  
Expected: PASS, including two concurrent new request IDs producing versions `1` and `2`, while one retried request returns version `1`.

### Task 4: Private S3 media boundary and public HTTP contract

**Files:**
- Create: `backend/src/toptrainers_api/core/object_storage.py`
- Modify: `backend/src/toptrainers_api/core/config.py`
- Modify: `backend/src/toptrainers_api/modules/tasks/{service,router,schemas,repository}.py`
- Modify: `backend/scripts/export_openapi.py`
- Test: `backend/tests/test_task_media.py`
- Test: `backend/tests/test_tasks_http_contract.py`
- Generated: `backend/openapi/openapi.json`

**Interfaces:** Produces `ObjectStorage.presign_put`, `ObjectStorage.presign_get`, `POST /tasks/{id}/media/uploads`, `POST /tasks/{id}/media/{media_id}/confirm`, `GET /tasks/{id}/media/{media_id}/read-url`, and client/trainer task result endpoints.

- [ ] **Step 1: Write failing media and HTTP contract tests**

```python
async def test_client_cannot_confirm_foreign_or_oversized_media(api_client) -> None:
    response = await api_client.post(f"/api/v1/tasks/{FOREIGN_TASK}/media/uploads", json={
        "filename": "proof.webp", "content_type": "image/webp", "size_bytes": 10 * 1024 * 1024 + 1,
    })
    assert response.status_code in {403, 404, 422}

def test_openapi_has_versioned_task_result_operation(schema) -> None:
    assert schema["paths"]["/api/v1/tasks/{task_assignment_id}/results"]["post"]["operationId"] == "submitTaskResultVersion"
```

- [ ] **Step 2: Run tests red**

Run: `cd backend && pytest tests/test_task_media.py tests/test_tasks_http_contract.py -q`  
Expected: FAIL because the endpoints and object-storage boundary do not exist.

- [ ] **Step 3: Implement safe presigning and task HTTP endpoints**

Use a configured boto3 client only in `core/object_storage.py`. Object keys use server-generated UUID prefixes, never client filenames. Enforce exact MIME allowlist and `size_bytes <= 10 * 1024 * 1024` before presigning; confirmation uses `head_object` to verify the object. Result submission accepts only confirmed media owned by the assignment client and validates required snapshot fields. Return `409 ACTIVE_RELATIONSHIP_REQUIRED` after relationship termination and hide foreign resources as `404`.

- [ ] **Step 4: Export OpenAPI and run green tests**

Run: `cd backend && python scripts/export_openapi.py && pytest tests/test_task_media.py tests/test_tasks_http_contract.py -q`  
Expected: PASS and `git diff --exit-code -- openapi/openapi.json` after the generated schema is committed to the working tree.

### Task 5: Generated contracts and Angular data-access layer

**Files:**
- Modify: `frontend/tools/openapi/{generate-all,generate}.mjs`
- Generated: `frontend/libs/shared/contracts/src/generated/{tasks,task-media}.ts`
- Create: `frontend/libs/shared/data-access/src/lib/tasks.ts`
- Create: `frontend/libs/shared/data-access/src/lib/task-media.ts`
- Modify: `frontend/libs/shared/data-access/src/index.ts`
- Test: `frontend/libs/shared/data-access/src/lib/tasks.test.ts`
- Test: `frontend/libs/shared/data-access/src/lib/task-media.test.ts`

**Interfaces:** Produces `TasksApi` and `TaskMediaApi`, both using generated operation paths/models and `apiUrl`.

- [ ] **Step 1: Write failing path and upload-flow tests**

```ts
it('builds the version submission path from generated metadata', () => {
  expect(taskOperationPath('submitResultVersion', 'task-1')).toBe('/tasks/task-1/results');
});

it('rejects a photo before presigning when it exceeds 10 MiB', () => {
  expect(validateTaskImage({ type: 'image/jpeg', size: 10 * 1024 * 1024 + 1 } as File)).toEqual({
    ok: false,
    reason: 'FILE_TOO_LARGE',
  });
});
```

- [ ] **Step 2: Run frontend test red**

Run: `cd frontend && pnpm vitest run libs/shared/data-access/src/lib/tasks.test.ts libs/shared/data-access/src/lib/task-media.test.ts`  
Expected: FAIL because task APIs do not exist.

- [ ] **Step 3: Generate contracts and implement APIs**

Follow `WorkoutAssignmentsApi`: derive paths from generated operation metadata, use injected runtime configuration, return typed observables, and preserve server errors. `TaskMediaApi` requests presigning, uploads with `HttpClient.put` to the presigned URL, confirms media, and never logs URLs with query signatures.

- [ ] **Step 4: Run green tests**

Run: `cd frontend && pnpm vitest run libs/shared/data-access/src/lib/tasks.test.ts libs/shared/data-access/src/lib/task-media.test.ts`  
Expected: PASS.

### Task 6: Replace trainer library/editor mock state

**Files:**
- Modify: `frontend/libs/pwa/feature-role-shell/src/lib/{library-hub,exercise-editor,workout-constructor,program-schedule,program-builder}.component.ts`
- Create: `frontend/libs/pwa/feature-role-shell/src/lib/task-template-editor.component.ts`
- Modify: `frontend/libs/pwa/feature-role-shell/src/index.ts`
- Test: `frontend/libs/pwa/feature-role-shell/src/lib/program-schedule.component.test.ts`
- Test: `frontend/libs/pwa/feature-role-shell/src/lib/workout-constructor.component.test.ts`

**Interfaces:** Consumes `TasksApi`, workout/program APIs and generated write models. Produces task-template editor and mixed ordered schedule/workout-task controls.

- [ ] **Step 1: Write failing UI state tests**

```ts
it('serializes two tasks and a workout in their day positions', () => {
  expect(schedulePayload(draft)).toEqual(expect.objectContaining({
    schedule_items: [
      expect.objectContaining({ kind: 'WORKOUT', position: 0 }),
      expect.objectContaining({ kind: 'TASK', position: 1 }),
      expect.objectContaining({ kind: 'TASK', position: 2 }),
    ],
  }));
});
```

- [ ] **Step 2: Run red**

Run: `cd frontend && pnpm vitest run libs/pwa/feature-role-shell/src/lib/program-schedule.component.test.ts libs/pwa/feature-role-shell/src/lib/workout-constructor.component.test.ts`  
Expected: FAIL because current components only own local arrays and workout-only schedule values.

- [ ] **Step 3: Implement trainer flows**

Load templates/workouts/programs from APIs, preserve loading/empty/error states, and route the library action to a template editor. Use an explicit add/reorder/remove action for each mixed schedule item and workout task; validate that every item selects one owned source before save. Do not render server-provided HTML.

- [ ] **Step 4: Run green**

Run: `cd frontend && pnpm vitest run libs/pwa/feature-role-shell/src/lib/program-schedule.component.test.ts libs/pwa/feature-role-shell/src/lib/workout-constructor.component.test.ts`  
Expected: PASS.

### Task 7: Client submission and trainer result history UI

**Files:**
- Modify: `frontend/libs/pwa/feature-role-shell/src/lib/{client-tasks,trainer-tasks,workout-player}.component.ts`
- Create: `frontend/libs/pwa/feature-role-shell/src/lib/task-result-form.component.ts`
- Test: `frontend/libs/pwa/feature-role-shell/src/lib/task-result-form.component.test.ts`
- Test: `frontend/libs/pwa/feature-role-shell/src/lib/client-tasks.component.test.ts`

**Interfaces:** Consumes `TasksApi`/`TaskMediaApi`; produces field-driven submission, progress/error state, and ordered result history.

- [ ] **Step 1: Write failing form tests**

```ts
it('requires a snapshot-required measurement and photo before submit', () => {
  expect(canSubmitTaskResult(requiredMeasurementAndPhoto, { measurement: null, mediaIds: [] })).toBe(false);
});

it('keeps workout completion available while its task is pending', () => {
  expect(workoutCompletionDisabled({ taskStatus: 'PENDING' })).toBe(false);
});
```

- [ ] **Step 2: Run red**

Run: `cd frontend && pnpm vitest run libs/pwa/feature-role-shell/src/lib/task-result-form.component.test.ts libs/pwa/feature-role-shell/src/lib/client-tasks.component.test.ts`  
Expected: FAIL because the new form and task-backed client state do not exist.

- [ ] **Step 3: Implement result and history UX**

Render only fields declared in the frozen task snapshot, validate before upload/submission, show per-file upload progress, disable submit while a request is in flight, and show a clear connection-required state rather than queueing photo submissions offline. Trainer view uses the latest result but exposes ordered version history; client sees the same own history. Keep the player completion control independent.

- [ ] **Step 4: Run green**

Run: `cd frontend && pnpm vitest run libs/pwa/feature-role-shell/src/lib/task-result-form.component.test.ts libs/pwa/feature-role-shell/src/lib/client-tasks.component.test.ts`  
Expected: PASS.

### Task 8: End-to-end verification and project memory

**Files:**
- Modify: `DOC/PROJECT_MEMORY.md`
- Modify: `DOC/ROADMAP.md`
- Modify: `DOC/DECISIONS.md` only if ADR-016 wording needs a compatibility amendment
- Test: existing full backend/frontend suites

**Interfaces:** None; records completed local capability and remaining exclusions.

- [ ] **Step 1: Review migration and OpenAPI diffs**

Run: `git diff --check && git diff -- backend/migrations backend/openapi frontend/libs/shared/contracts`  
Expected: task changes are additive/data-preserving, no credentials appear, and no unrelated API payload changes exist.

- [ ] **Step 2: Run backend quality and PostgreSQL gates**

Run: `cd backend && ruff check . && mypy src && pytest && python scripts/export_openapi.py && git diff --exit-code -- openapi/openapi.json`  
Expected: all commands pass.

- [ ] **Step 3: Run frontend quality gates**

Run: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`  
Expected: all commands pass.

- [ ] **Step 4: Record the local delivery state**

Update project memory with tasks and S3 upload scope, explicitly retaining the exclusions: no offline photo queue, notifications, video, analytics, or automatic approval. Update the roadmap wording from its older program-only schedule assumption.

- [ ] **Step 5: Final diff review**

Run: `git status --short && git diff --check`  
Expected: only task/S3 implementation, generated contracts, tests, migrations, and the required DOC records are modified; do not commit, push, or deploy until the owner accepts the local result.
