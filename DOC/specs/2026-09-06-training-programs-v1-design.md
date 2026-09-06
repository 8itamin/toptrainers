# Training Programs v1 — backend design

## Goal

Evolve the existing Trainer `Program` metadata into a mutable scheduled training program that can be atomically issued to a Client as a set of ordinary `WorkoutAssignment` children, without introducing a second execution engine or changing the existing `Assignment → Execution → Results → History` lifecycle.

Product intent: let a Trainer define a multi-week schedule once and issue it as a coherent plan, while preserving the existing reliable semantics of each workout assignment.

## Scope

`Training Programs v1` adds:

- mutable Program schedule slots;
- full schedule replacement on Program update;
- immutable `ProgramAssignment` issuance parent;
- immutable Program snapshot containing schedule and Workout IDs only;
- ordinary child `WorkoutAssignment` rows with frozen Workout snapshots;
- nullable provenance on child Assignments;
- parent-level idempotency for atomic issuance;
- explicit ProgramAssignment cancellation that cancels only still-`PLANNED` children.

Out of scope:

- Program Sync after issuance;
- editing an issued ProgramAssignment;
- adding/removing children after issuance;
- lazy/background issuance;
- parent auto-completion;
- parent status synchronization from child lifecycle;
- schedule recurrence rules;
- multiple workouts in one `(week_number, day_number)` slot;
- whole-program reschedule;
- adherence/analytics;
- Program version history for mutable drafts;
- frontend UI.

## Existing baseline

The existing `programs` table contains:

- `id`
- `trainer_id`
- `title`
- `description`
- physical `weeks`

The existing `WorkoutAssignment` is lifecycle authority for workouts and owns an immutable frozen `workout_snapshot`. `WorkoutExecution`, Results and History already operate only through ordinary `WorkoutAssignment` rows and must remain Program-agnostic.

## Public Program contract

The existing physical `programs.weeks` column is preserved. The canonical public API field is renamed to:

```text
duration_weeks
```

`weeks` becomes an internal persistence detail and MUST NOT appear in the public Program DTOs.

Allowed duration:

```text
1 <= duration_weeks <= 52
```

A Program may have an empty schedule and still be saved.

## Calendar semantics

A slot is identified by:

```text
week_number = 1..duration_weeks
day_number  = 1..7
```

`start_date` means day 1 of Program week 1. It is not required to be Monday.

A child scheduled date is calculated as:

```text
scheduled_date = start_date
               + (week_number - 1) * 7 days
               + (day_number - 1) days
```

Examples:

- `(1,1)` => `start_date`
- `(1,7)` => `start_date + 6 days`
- `(2,1)` => `start_date + 7 days`

## Persistence

Add migration:

```text
20260906_0010_training_programs_v1
```

with `down_revision = 20260904_0009`.

The migration is additive: no backfill is required.

### `program_slots`

```text
program_slots

id            VARCHAR(36) PK
program_id    FK programs.id NOT NULL
week_number   INTEGER NOT NULL
day_number    INTEGER NOT NULL
workout_id    FK workouts.id NOT NULL
```

Constraints:

```text
UNIQUE(program_id, week_number, day_number)
CHECK week_number >= 1
CHECK day_number BETWEEN 1 AND 7
```

`week_number <= Program.duration_weeks` is an application invariant because it depends on another row.

Program update is full schedule replacement. Live slot IDs are not historical identities and may be replaced on each full update.

### `program_assignments`

```text
program_assignments

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
```

Constraints:

```text
UNIQUE(relationship_id, request_id)
CHECK snapshot_schema_version = 1
CHECK status IN ('ACTIVE', 'CANCELLED')
```

Parent status has deliberately narrow meaning:

- `ACTIVE`: no explicit ProgramAssignment cancellation was performed;
- `CANCELLED`: Trainer explicitly cancelled the ProgramAssignment and all children that were `PLANNED` at that moment were cancelled.

Parent status does not auto-follow child lifecycle and does not auto-complete.

### Child provenance in `workout_assignments`

Add nullable fields:

```text
program_assignment_id  VARCHAR(36) NULL FK program_assignments.id
program_slot_id        VARCHAR(36) NULL
```

`program_slot_id` is immutable copied provenance and MUST NOT be a foreign key to live `program_slots`, because Program updates replace live slots while historical issued Assignments must remain traceable to their frozen Program snapshot.

Constraint:

```text
(program_assignment_id IS NULL AND program_slot_id IS NULL)
OR
(program_assignment_id IS NOT NULL AND program_slot_id IS NOT NULL)
```

Add an index on `workout_assignments.program_assignment_id` for child lookup/cancellation.

Direct Assignments remain:

```text
program_assignment_id = NULL
program_slot_id = NULL
```

## Program snapshot v1

`ProgramAssignment.program_snapshot` is immutable and contains Program metadata plus frozen schedule coordinates and Workout IDs, but never Workout content.

Shape:

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

The child `WorkoutAssignment.workout_snapshot` remains the authoritative frozen Workout content.

Therefore:

- later Program edits do not affect the ProgramAssignment snapshot or children;
- later Workout edits do not affect child Workout snapshots;
- current Program/Workout rows are never needed to interpret historical issued children.

## Program API

Keep the existing `/api/v1/programs` resource and evolve its contract.

### List

```text
GET /api/v1/programs
operationId: listTrainingPrograms
```

### Create

```text
POST /api/v1/programs
operationId: createTrainingProgram
```

Request:

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

Empty `slots` is valid.

### Get

```text
GET /api/v1/programs/{program_id}
operationId: getTrainingProgram
```

Trainer may read only own Program.

### Full replacement update

```text
PUT /api/v1/programs/{program_id}
operationId: replaceTrainingProgram
```

PUT replaces Program metadata and complete schedule in one transaction.

Flow:

```text
Program FOR UPDATE
→ validate complete incoming schedule
→ validate all Workout ownership
→ replace all live slots
→ commit once
```

Any validation/write failure preserves the previous complete Program state.

Every newly persisted live slot gets a backend-generated `id`; old slot IDs are not reused as historical version IDs.

## Program validation

Pydantic/request-level bounds:

- `duration_weeks: 1..52`
- `week_number >= 1`
- `day_number: 1..7`

Business invariants:

- duplicate `(week_number, day_number)` => `409 PROGRAM_SLOT_DUPLICATE`;
- slot with `week_number > duration_weeks` => `409 PROGRAM_SLOT_OUTSIDE_DURATION`;
- nonexistent or foreign Trainer Workout is hidden as `404 PROGRAM_WORKOUT_NOT_FOUND`.

A Program may be empty, but an empty Program cannot be assigned.

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
- every referenced Workout remains available to the Trainer at issuance time.

If a previously saved Program contains a now unavailable Workout, issuance fails atomically with `409 PROGRAM_NOT_ASSIGNABLE`; no slot is silently skipped.

### Get ProgramAssignment

```text
GET /api/v1/program-assignments/{program_assignment_id}
operationId: getProgramAssignment
```

Readable by the Trainer/Client party of the Relationship, including a terminated historical Relationship.

The response contains parent snapshot and a lightweight child list, not child full Workout snapshots.

Child detail continues through the existing:

```text
GET /api/v1/assignments/{assignment_id}
```

No ProgramAssignment list endpoint is required in v1.

### Cancel ProgramAssignment

```text
POST /api/v1/program-assignments/{program_assignment_id}/cancel
operationId: cancelProgramAssignment
```

Trainer-only and idempotent.

Cancellation:

- cancels only child Assignments currently `PLANNED`;
- leaves `IN_PROGRESS` untouched;
- leaves `COMPLETED`, Results and History untouched;
- sets parent status to `CANCELLED` and `cancelled_at` once;
- repeated cancellation returns the existing parent state.

Individual child reschedule/cancel continues to affect only that child and never siblings or parent status.

## ProgramAssignment response

Recommended response shape:

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

## Parent idempotency

Authoritative key:

```text
(relationship_id, request_id)
```

For an existing key, command equality is defined only by immutable original command fields:

```text
source_program_id
start_date
```

Rules:

- same request ID + same Program + same start date => return original ProgramAssignment and original children;
- this remains true after Program edits or Workout edits;
- same request ID + different Program or different start date => `409 PROGRAM_ASSIGNMENT_REQUEST_ID_CONFLICT`.

Current Program state MUST NOT be used to decide retry equality.

Child request IDs are generated by the backend and are not the Program API idempotency contract.

## Shared commit-free Assignment materializer

The existing `assignments.service.create_assignment()` currently owns authorization/idempotency/snapshot/persistence/commit. It MUST NOT be called in a Program slot loop because its internal commit would make atomic rollback impossible.

Extract one shared Assignment materialization contract inside the `assignments` module, conceptually:

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

- verify/load Trainer-owned Workout;
- load required Exercises;
- build the existing `WorkoutSnapshotV1`;
- instantiate/add `WorkoutAssignment(PLANNED)`;
- populate optional Program provenance;
- optionally `flush()`;
- never `commit()`;
- never `rollback()`.

Direct Assignment refactors to use the same materializer and retains existing external behavior/idempotency, then commits once at its own service boundary.

`programs.service` uses the public `assignments.service` materializer; it MUST NOT import `assignments.repository` directly.

## Atomic issuance transaction

Program issuance owns exactly one commit:

```text
BEGIN

Client Account FOR UPDATE
→ ACTIVE Relationship FOR UPDATE
→ lookup existing ProgramAssignment by (relationship_id, request_id)

if existing:
    same original command => return original
    different command => 409

→ Program FOR UPDATE
→ load complete current schedule
→ validate non-empty / ownership
→ freeze Program snapshot
→ create ProgramAssignment
→ flush parent ID
→ materialize every child WorkoutAssignment without commits
→ flush
→ COMMIT ONCE
```

Any failure before final commit rolls back parent and every child.

No partial Program issuance is allowed.

## Locking and concurrency

### Edit vs Assign

`Program FOR UPDATE` is the shared serialization point.

Edit:

```text
Program FOR UPDATE
→ replace full schedule
→ commit
```

Assign:

```text
Account
→ Relationship
→ Program FOR UPDATE
→ snapshot/materialize
→ commit
```

Concurrent Edit vs Assign therefore yields either the complete old schedule or the complete new schedule, never a mixture.

### Concurrent identical first Assign

Relationship locking serializes first issuance. The loser observes the already committed parent by `(relationship_id, request_id)` and returns it when command equality matches. DB uniqueness remains defense in depth.

### Program cancellation vs child Start

Existing child Start lock order is:

```text
Client Account → Relationship → Assignment → Execution
```

Program cancellation must acquire the same Relationship serialization point before locking parent/children:

```text
Client Account → Relationship → ProgramAssignment → child Assignments
```

Outcomes:

- cancellation wins: `PLANNED` child becomes `CANCELLED`; later Start is rejected by existing Assignment lifecycle;
- Start wins: child becomes `IN_PROGRESS` and Execution is created; later Program cancellation leaves that child untouched.

The system MUST never produce `Assignment=CANCELLED` with an existing started Execution due to this race.

For v1, lock/select all children `FOR UPDATE` before cancellation. Maximum theoretical schedule size is 364 children, so explicit row locking is acceptable and safer than an unsynchronized bulk update.

## Relationship termination

No Program-specific termination logic is added.

Existing Relationship termination already cancels ordinary child Assignments whose status is `PLANNED`, so it naturally applies to Program-derived children as well.

`ProgramAssignment.status` is not changed by Relationship termination; otherwise the system would require continuous parent/child synchronization, which is explicitly out of scope.

## Existing core compatibility

Program-derived children are ordinary `WorkoutAssignment` rows. Existing APIs and lifecycle remain authoritative:

- child reschedule;
- child cancel;
- Execution Start/Complete;
- Results mutation/read;
- Workout History.

Existing Direct Assignment response semantics need not expose Program provenance in v1. Program provenance is available through ProgramAssignment reads.

History and Results require no Program-specific production logic. Completed Program-derived children must appear through existing History and Results flows automatically.

## Error contract

Recommended business codes:

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

Foreign Workout ownership is intentionally hidden as not-found to avoid information disclosure.

## Component boundaries

Target module structure:

```text
backend/src/toptrainers_api/modules/programs/
  models.py
  schemas.py
  repository.py
  service.py
  router.py
```

`programs.service` owns:

- Program create/read/update;
- full schedule replacement;
- Program row locking orchestration;
- ProgramAssignment issuance;
- parent idempotency;
- ProgramAssignment read;
- Program cancellation.

`programs.repository` owns Program/slot/parent persistence and SQL locking queries.

`assignments.service` owns shared commit-free child materialization and existing child lifecycle.

## Migration / rollback policy

Migration `0010` must support isolated dev/test upgrade/downgrade roundtrip.

Operationally, after production writes exist in `program_slots`, `program_assignments` or child provenance, destructive database downgrade `0010 → 0009` is not a normal rollback path. Application rollback is app-only; database recovery uses backup/PITR policy.

## Required tests

### Program schedule

- empty Program saves;
- public `duration_weeks` is used and `weeks` does not leak;
- duplicate week/day rejected;
- slot beyond duration rejected;
- foreign Trainer Workout rejected/hidden;
- PUT is full schedule replacement;
- failed replacement preserves previous complete schedule.

### Issuance

- empty Program assign rejected;
- full issuance produces exact child count;
- scheduled-date mapping across week boundary;
- parent snapshot frozen;
- child Workout snapshots frozen;
- Program edit after issuance leaves parent/children unchanged;
- Workout edit after issuance leaves children unchanged;
- failure on any slot rolls back parent and every child.

### Idempotency

- repeated same request ID creates no duplicate;
- retry after Program edit returns original issuance;
- same request ID/different Program => 409;
- same request ID/different start date => 409;
- concurrent identical first Assign => one parent and exact child count.

### Concurrency / lifecycle

- concurrent Edit vs Assign yields all-old or all-new schedule, never mixed;
- child reschedule does not affect siblings;
- child cancel does not affect siblings;
- Program cancellation cancels `PLANNED` only;
- repeated Program cancellation is idempotent;
- cancellation vs Start race verifies both winner orders;
- Relationship termination preserves existing semantics.

### Existing core regression

- Direct Assignment remains unchanged with NULL provenance;
- Program-derived child can Start and Complete;
- Program-derived completed child Results work through existing Results API;
- Program-derived completed child appears in existing History;
- current Program/Workout edits do not alter historical Results/History mapping.

### Migration / OpenAPI

- `0009 → 0010` upgrade;
- schema columns, FKs, constraints and index;
- existing Assignments survive with NULL provenance;
- isolated `0010 → 0009 → 0010` roundtrip;
- canonical Alembic head becomes `20260906_0010_training_programs_v1`;
- authoritative OpenAPI is generated from FastAPI, never edited manually;
- expected operation IDs and DTO schemas are present;
- full PostgreSQL regression suite passes.

## ADR numbering

`DOC/DECISIONS.md` currently ends at ADR-014 (WorkoutExecution), while Workout Results v1 is already an accepted production architecture. This change must close the numbering drift as follows:

- ADR-015 — Workout Results v1;
- ADR-016 — Training Programs v1.

ADR-015 records the already accepted Results architecture; ADR-016 records this approved Program architecture.
