# Training Programs v1 — backend design

## Goal

Evolve the existing Trainer `Program` metadata into a mutable scheduled training program that can be atomically issued to a Client as a set of ordinary `WorkoutAssignment` children, without introducing a second execution engine or changing the existing `Assignment → Execution → Results → History` lifecycle.

Product intent: let a Trainer define a multi-week schedule once and issue it as a coherent plan while preserving the proven semantics of every child workout assignment.

## Scope

`Training Programs v1` adds:

- mutable Program schedule slots;
- full schedule replacement on Program update;
- immutable `ProgramAssignment` issuance parent;
- immutable Program snapshot containing schedule and Workout IDs only;
- ordinary child `WorkoutAssignment` rows with frozen Workout snapshots;
- nullable child provenance;
- parent-level idempotency for atomic issuance;
- explicit ProgramAssignment cancellation that cancels only still-`PLANNED` children.

Out of scope:

- Program Sync after issuance;
- editing an issued ProgramAssignment;
- adding/removing children after issuance;
- lazy/background issuance;
- parent auto-completion or parent status synchronization from child lifecycle;
- recurrence rules;
- multiple workouts in one `(week_number, day_number)` slot;
- whole-program reschedule;
- adherence/analytics;
- Program version history for mutable drafts;
- frontend UI.

## Existing baseline

The existing `programs` table contains `id`, `trainer_id`, `title`, `description` and physical `weeks`.

`WorkoutAssignment` remains the lifecycle authority and already owns immutable `workout_snapshot`. `WorkoutExecution`, Results and History operate through ordinary `WorkoutAssignment` rows and remain Program-agnostic.

## Public Program contract

The physical `programs.weeks` column is preserved. The canonical public field is:

```text
duration_weeks
```

`weeks` is persistence-only and MUST NOT leak into public Program DTOs.

Allowed duration:

```text
1 <= duration_weeks <= 52
```

A Program may be saved with `slots: []`.

Mutable Program request/response slots use only:

```text
week_number
day_number
workout_id
```

The internal live `ProgramSlot.id` is not part of the mutable Program command contract and must not be treated as a stable public identity.

All mutable Program schedule responses are ordered deterministically by:

```text
week_number ASC, day_number ASC
```

## Calendar semantics

```text
week_number = 1..duration_weeks
day_number  = 1..7
```

`start_date` is day 1 of Program week 1 and need not be Monday.

```text
scheduled_date = start_date
               + (week_number - 1) * 7 days
               + (day_number - 1) days
```

Examples:

- `(1,1)` => `start_date`
- `(1,7)` => `start_date + 6 days`
- `(2,1)` => `start_date + 7 days`

## Migration

Add:

```text
20260906_0010_training_programs_v1
```

with:

```text
down_revision = 20260904_0009
```

The migration is additive and requires no backfill.

### `program_slots`

```text
id            VARCHAR(36) PK
program_id    FK programs.id NOT NULL
week_number   INTEGER NOT NULL
day_number    INTEGER NOT NULL
workout_id    FK workouts.id NOT NULL

UNIQUE(program_id, week_number, day_number)
CHECK week_number >= 1
CHECK day_number BETWEEN 1 AND 7
```

`week_number <= duration_weeks` is an application invariant because it depends on another row.

Program update is full schedule replacement. New persisted live slots receive backend-generated IDs; old live slot IDs are not historical version IDs.

### `program_assignments`

```text
id                       VARCHAR(36) PK
relationship_id          FK trainer_client_relationships.id NOT NULL
source_program_id        FK programs.id NOT NULL
request_id               VARCHAR(128) NOT NULL
start_date               DATE NOT NULL
program_snapshot          JSONB NOT NULL
snapshot_schema_version   INTEGER NOT NULL DEFAULT 1
status                    VARCHAR(16) NOT NULL
created_at                TIMESTAMPTZ NOT NULL
cancelled_at              TIMESTAMPTZ NULL

UNIQUE(relationship_id, request_id)
CHECK snapshot_schema_version = 1
CHECK status IN ('ACTIVE', 'CANCELLED')
```

Parent status semantics are deliberately narrow:

- `ACTIVE` — no explicit ProgramAssignment cancellation was performed;
- `CANCELLED` — Trainer explicitly cancelled the ProgramAssignment and all children that were `PLANNED` at that moment were cancelled.

Parent status does not auto-follow child state and does not auto-complete.

### Child provenance in `workout_assignments`

Add:

```text
program_assignment_id  VARCHAR(36) NULL FK program_assignments.id
program_slot_id        VARCHAR(36) NULL
```

`program_slot_id` is immutable copied provenance and MUST NOT be a FK to live `program_slots`. Program updates replace live slots, while historical issued children must remain traceable to the slot occurrence frozen in their parent snapshot.

Constraint:

```text
(program_assignment_id IS NULL AND program_slot_id IS NULL)
OR
(program_assignment_id IS NOT NULL AND program_slot_id IS NOT NULL)
```

Add an index on `workout_assignments.program_assignment_id`.

Direct Assignments remain:

```text
program_assignment_id = NULL
program_slot_id = NULL
```

## Program snapshot v1

`ProgramAssignment.program_snapshot` is immutable and contains Program metadata, frozen schedule coordinates and Workout IDs, but never Workout content.

```json
{
  "title": "Силовой цикл",
  "description": "",
  "duration_weeks": 4,
  "slots": [
    {
      "slot_id": "...",
      "week_number": 1,
      "day_number": 1,
      "workout_id": "..."
    }
  ]
}
```

Snapshot slots are sorted by `(week_number, day_number)`.

The child `WorkoutAssignment.workout_snapshot` remains the authoritative frozen Workout content.

Consequences:

- later Program edits do not change parent snapshot or children;
- later Workout edits do not change child Workout snapshots;
- current Program/Workout rows are not required to interpret historical issued children.

## Program API

Keep `/api/v1/programs` and evolve its contract.

```text
GET  /api/v1/programs
operationId: listTrainingPrograms

POST /api/v1/programs
operationId: createTrainingProgram

GET  /api/v1/programs/{program_id}
operationId: getTrainingProgram

PUT  /api/v1/programs/{program_id}
operationId: replaceTrainingProgram
```

Create/replace body:

```json
{
  "title": "Силовой цикл",
  "description": "",
  "duration_weeks": 4,
  "slots": [
    {
      "week_number": 1,
      "day_number": 1,
      "workout_id": "..."
    }
  ]
}
```

`slots: []` is valid.

PUT is full replacement:

```text
Program FOR UPDATE
→ validate complete incoming schedule
→ validate all Workout ownership
→ replace all live slots
→ commit once
```

Any failure preserves the previous complete Program state.

Trainer may read/mutate only own Programs.

## Program validation

Request-level bounds:

- `duration_weeks: 1..52`
- `week_number >= 1`
- `day_number: 1..7`

Business invariants:

- duplicate `(week_number, day_number)` => `409 PROGRAM_SLOT_DUPLICATE`;
- `week_number > duration_weeks` => `409 PROGRAM_SLOT_OUTSIDE_DURATION`;
- nonexistent or foreign Trainer Workout => `404 PROGRAM_WORKOUT_NOT_FOUND`.

Foreign ownership is intentionally hidden as not-found.

## ProgramAssignment API

### Assign Program

```text
POST /api/v1/programs/{program_id}/assignments
operationId: createProgramAssignment
```

Trainer-only request:

```json
{
  "client_id": "...",
  "start_date": "2026-09-07",
  "request_id": "..."
}
```

Required:

- active Trainer–Client Relationship;
- Program belongs to Trainer;
- Program contains at least one slot;
- every referenced Workout is still available to that Trainer at issuance time.

Empty Program => `409 PROGRAM_EMPTY`.

If a previously valid Program cannot now materialize all referenced Workouts, issuance fails atomically with `409 PROGRAM_NOT_ASSIGNABLE`; no slot is skipped.

### Get ProgramAssignment

```text
GET /api/v1/program-assignments/{program_assignment_id}
operationId: getProgramAssignment
```

Readable by the Trainer/Client party of the Relationship, including terminated historical Relationships.

The response contains the parent snapshot plus a lightweight child list. Full child Workout snapshots remain available only through existing Assignment detail.

No ProgramAssignment list endpoint is required in v1.

### Cancel ProgramAssignment

```text
POST /api/v1/program-assignments/{program_assignment_id}/cancel
operationId: cancelProgramAssignment
```

Trainer-only and idempotent.

Cancellation:

- cancels only children currently `PLANNED`;
- leaves `IN_PROGRESS` untouched;
- leaves `COMPLETED`, Results and History untouched;
- sets parent `status=CANCELLED` and `cancelled_at` once;
- repeated cancellation returns the same parent state.

Individual child reschedule/cancel affects only that child and never siblings or parent status.

## ProgramAssignment response

```json
{
  "id": "...",
  "relationship_id": "...",
  "trainer_id": "...",
  "client_id": "...",
  "source_program_id": "...",
  "request_id": "...",
  "start_date": "2026-09-07",
  "status": "ACTIVE",
  "snapshot_schema_version": 1,
  "program_snapshot": {
    "title": "Силовой цикл",
    "description": "",
    "duration_weeks": 4,
    "slots": [
      {
        "slot_id": "...",
        "week_number": 1,
        "day_number": 1,
        "workout_id": "..."
      }
    ]
  },
  "assignments": [
    {
      "assignment_id": "...",
      "program_slot_id": "...",
      "scheduled_date": "2026-09-07",
      "status": "PLANNED"
    }
  ],
  "created_at": "..."
}
```

`assignments[]` is ordered by the frozen schedule order `(week_number, day_number)` represented by `program_slot_id` in the parent snapshot.

## Parent idempotency

Authoritative key:

```text
(relationship_id, request_id)
```

For an existing key, command equality uses only:

```text
source_program_id
start_date
```

Rules:

- same request ID + same Program + same start date => return original parent and original children;
- retry remains original after Program/Workout edits;
- same request ID + different Program or start date => `409 PROGRAM_ASSIGNMENT_REQUEST_ID_CONFLICT`.

Current Program state MUST NOT participate in retry equality.

Child request IDs are opaque backend-generated values and are not the Program API idempotency contract.

## Shared commit-free Assignment materializer

The existing `assignments.service.create_assignment()` commits internally and MUST NOT be called in a Program slot loop.

Extract a shared commit-free materializer in the `assignments` module, conceptually:

```python
async def materialize_assignment(
    session,
    *,
    relationship,
    trainer_id,
    workout_id,
    scheduled_date,
    request_id,
    program_assignment_id=None,
    program_slot_id=None,
) -> WorkoutAssignment:
    ...
```

Responsibilities:

- load/verify Trainer-owned Workout;
- load required Exercises;
- build existing `WorkoutSnapshotV1`;
- instantiate/add `WorkoutAssignment(PLANNED)`;
- populate optional Program provenance;
- optionally flush;
- never commit or rollback.

Direct Assignment refactors to use the same materializer and keeps its existing external behavior/idempotency before committing at its own service boundary.

## Atomic issuance transaction

Program issuance owns exactly one commit:

```text
BEGIN

Client Account FOR UPDATE
→ ACTIVE Relationship FOR UPDATE
→ lookup ProgramAssignment by (relationship_id, request_id)

if existing:
    same original command => return original
    different command => 409

→ Program FOR UPDATE
→ load complete current slots ordered by week/day
→ validate non-empty / ownership
→ freeze Program snapshot
→ create ProgramAssignment
→ flush parent ID
→ materialize every child without commits
→ flush
→ COMMIT ONCE
```

Any failure rolls back parent and every child. Partial issuance is forbidden.

## Locking and concurrency

### Edit vs Assign

`Program FOR UPDATE` is the shared serialization point.

Edit:

```text
Program FOR UPDATE → replace complete schedule → commit
```

Assign:

```text
Account → Relationship → Program FOR UPDATE → snapshot/materialize → commit
```

The race yields either all-old or all-new schedule, never mixed.

### Concurrent identical first Assign

Relationship locking serializes competing first issuance attempts. The loser observes the committed `(relationship_id, request_id)` parent and returns it when original command fields match. DB uniqueness is defense in depth.

### Program cancellation vs child Start

Existing Start lock order:

```text
Client Account → Relationship → Assignment → Execution
```

Program cancellation:

```text
Client Account → Relationship → ProgramAssignment → child Assignments
```

The Relationship lock is the common serialization point.

Outcomes:

- Cancel wins => PLANNED child becomes CANCELLED; later Start is rejected by existing lifecycle;
- Start wins => child becomes IN_PROGRESS with Execution; later Program cancellation leaves it untouched.

The race MUST NOT produce a cancelled Assignment with a started Execution.

At most 364 schedule slots exist (`52 × 7`), so v1 may explicitly lock all children `FOR UPDATE` before applying PLANNED-only cancellation.

## Assignment-module ownership for child operations

`WorkoutAssignment` remains owned by the `assignments` module.

Therefore `programs.repository` MUST NOT query/update child `WorkoutAssignment` rows directly.

The `assignments` module exposes commit-free public service contracts for Program orchestration, conceptually:

```text
materialize_assignment(...)
list_program_children(...)
cancel_planned_program_children(...)
```

`cancel_planned_program_children(...)` performs required child `FOR UPDATE` locking and PLANNED-only state changes but never commits. `programs.service` owns the parent transaction and final commit.

This keeps Assignment lifecycle authority and persistence ownership in one module and avoids `programs → assignments.repository` coupling.

## Relationship termination

No Program-specific termination logic is added.

Existing Relationship termination already cancels ordinary `PLANNED` child Assignments and therefore automatically applies to Program-derived children.

`ProgramAssignment.status` is not changed by Relationship termination. Synchronizing parent status from child/Relationship lifecycle would introduce Program Sync, which is out of scope.

## Existing core compatibility

Program-derived children are ordinary `WorkoutAssignment` rows. Existing APIs remain authoritative for:

- child reschedule/cancel;
- Execution Start/Complete;
- Results;
- History.

Direct Assignment behavior remains unchanged and its provenance fields stay NULL.

Existing `WorkoutAssignmentResponse` need not expose Program provenance in v1; provenance is available through ProgramAssignment reads.

History and Results require no Program-specific production branches. Completed Program-derived children must work through the existing flows unchanged.

## Error contract

- `PROGRAM_NOT_FOUND`
- `PROGRAM_SLOT_DUPLICATE`
- `PROGRAM_SLOT_OUTSIDE_DURATION`
- `PROGRAM_WORKOUT_NOT_FOUND`
- `PROGRAM_EMPTY`
- `PROGRAM_NOT_ASSIGNABLE`
- `ACTIVE_RELATIONSHIP_REQUIRED`
- `PROGRAM_ASSIGNMENT_NOT_FOUND`
- `PROGRAM_ASSIGNMENT_REQUEST_ID_CONFLICT`
- `PROGRAM_ASSIGNMENT_TRAINER_REQUIRED`
- `ROLE_NOT_ALLOWED`

## Component boundaries

Target `programs` module:

```text
backend/src/toptrainers_api/modules/programs/
  models.py
  schemas.py
  repository.py
  service.py
  router.py
```

`programs.repository` owns only Program, ProgramSlot and ProgramAssignment persistence/locking.

`programs.service` owns Program commands, schedule replacement, parent issuance/idempotency/read/cancel orchestration and the single transaction boundary.

`assignments.service` owns child materialization, Program-child read/cancel helpers and all Assignment lifecycle transitions.

`programs` MUST NOT import `assignments.repository` directly.

## Rollback policy

Migration `0010` supports isolated dev/test upgrade/downgrade roundtrip.

After production writes exist in `program_slots`, `program_assignments` or child provenance, destructive DB downgrade `0010 → 0009` is not a normal rollback path. Application rollback is app-only; database recovery uses backup/PITR policy.

## Required tests

### Program schedule

- empty Program saves;
- `duration_weeks` is public and `weeks` does not leak;
- deterministic slot ordering;
- duplicate week/day rejected;
- slot beyond duration rejected;
- foreign Trainer Workout hidden/rejected;
- PUT is full replacement;
- failed replacement preserves the old complete schedule.

### Issuance

- empty Program assign rejected;
- exact child count;
- scheduled-date mapping including week boundary;
- deterministic child order;
- parent snapshot frozen;
- child Workout snapshots frozen;
- Program edit after issuance leaves parent/children unchanged;
- Workout edit after issuance leaves children unchanged;
- any slot failure rolls back parent and every child.

### Idempotency

- repeated same request ID creates no duplicate;
- retry after Program edit returns original issuance;
- same request ID/different Program => 409;
- same request ID/different start date => 409;
- concurrent identical first Assign => one parent and exact children.

### Concurrency / lifecycle

- Edit vs Assign => all-old or all-new, never mixed;
- child reschedule does not affect siblings;
- child cancel does not affect siblings;
- Program cancellation cancels PLANNED only;
- repeated Program cancellation is idempotent;
- Program cancellation vs Start verifies both winner orders;
- Relationship termination preserves existing semantics.

### Existing core regression

- Direct Assignment unchanged with NULL provenance;
- Program-derived child Start/Complete works;
- Program-derived completed child Results work through existing Results API;
- Program-derived completed child appears in existing History;
- later Program/Workout edits do not alter historical Results/History behavior.

### Migration / OpenAPI

- `0009 → 0010` upgrade;
- expected tables/columns/FKs/checks/index;
- existing Assignments survive with NULL provenance;
- isolated `0010 → 0009 → 0010` roundtrip;
- canonical Alembic head becomes `20260906_0010_training_programs_v1`;
- authoritative OpenAPI is generated from FastAPI, never manually edited;
- operation IDs/DTO schemas are present;
- full PostgreSQL regression suite passes.

## ADR numbering

`DOC/DECISIONS.md` previously ended at ADR-014 while Workout Results v1 was already accepted and released. Numbering is closed as:

- ADR-015 — Workout Results v1;
- ADR-016 — Training Programs v1.
