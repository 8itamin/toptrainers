# Workout Results v1 — backend design

## Goal

Add minimal factual set results to the existing `WorkoutAssignment` + singleton `WorkoutExecution` flow without changing Assignment/Execution lifecycle or Workout History semantics.

## Scope

Results belong to a concrete `WorkoutExecution` and to a concrete planned set identified only by frozen Assignment snapshot coordinates:

`(block_position, exercise_position, set_index)`.

`source_exercise_id` is provenance metadata only and MUST NOT be used as Result identity.

Out of scope: Programs, result revisions, request IDs, offline mutation, realtime, analytics, new lifecycle states, automatic completion, current Workout lookup for result mapping.

## Persistence

Create additive migration `20260904_0009` over `20260904_0008` and table:

```text
workout_execution_set_results

execution_id       FK workout_executions.id
block_position     INTEGER NOT NULL
exercise_position  INTEGER NOT NULL
set_index          INTEGER NOT NULL
actual_reps        INTEGER NULL
actual_weight_kg   NUMERIC(6,2) NULL

PRIMARY KEY (execution_id, block_position, exercise_position, set_index)
```

DB checks:

- `block_position >= 0`
- `exercise_position >= 0`
- `set_index >= 0`
- `actual_reps IS NULL OR actual_reps BETWEEN 0 AND 1000`
- `actual_weight_kg IS NULL OR actual_weight_kg BETWEEN 0 AND 1000`
- `actual_reps IS NOT NULL OR actual_weight_kg IS NOT NULL`

No extra indexes beyond the composite primary key. No backfill.

## Frozen-coordinate validation

The Assignment snapshot is authoritative. For each mutation:

1. find snapshot block with `block.position == block_position`;
2. find snapshot exercise with `exercise.position == exercise_position`;
3. require `0 <= set_index < exercise.sets`.

The current Workout/Exercise tables are never consulted for result mapping.

Duplicate `source_exercise_id` values in different frozen occurrences remain independent resources because identity is positional.

## API

### List

```text
GET /api/v1/assignments/{assignment_id}/execution/results
operationId: listWorkoutExecutionResults
```

Returns `WorkoutExecutionSetResultResponse[]`, ordered by:

`block_position ASC, exercise_position ASC, set_index ASC`.

### Put resource

```text
PUT /api/v1/assignments/{assignment_id}/execution/results/{block_position}/{exercise_position}/{set_index}
operationId: putWorkoutExecutionSetResult
```

Body:

```json
{
  "actual_reps": 10,
  "actual_weight_kg": 82.5
}
```

Both values are optional/nullable individually, but at least one must be non-null. `actual_reps=0` is valid.

First save and correction both return `200 WorkoutExecutionSetResultResponse`.

### Delete resource

```text
DELETE /api/v1/assignments/{assignment_id}/execution/results/{block_position}/{exercise_position}/{set_index}
operationId: deleteWorkoutExecutionSetResult
```

Returns `204`. Repeated DELETE is also `204` when Assignment/Execution/coordinate authorization and validation succeed.

## DTOs

`WorkoutExecutionSetResultUpsertRequest`:

- `actual_reps: int | None`, `0..1000`
- `actual_weight_kg: Decimal | None`, `0..1000`
- model-level validation: at least one non-null

`WorkoutExecutionSetResultResponse`:

- `execution_id`
- `block_position`
- `exercise_position`
- `set_index`
- `actual_reps`
- `actual_weight_kg`

## Authorization and lifecycle

### Client mutation

PUT/DELETE are Client-only.

Required:

- Assignment belongs to a Relationship whose `client_id == current_client`;
- singleton Execution exists;
- Assignment status is `IN_PROGRESS` or `COMPLETED`;
- coordinate exists in frozen snapshot.

Relationship `ACTIVE` status is NOT required. Corrections after Assignment completion and after Relationship termination are allowed. Results never change Assignment status or `Execution.completed_at`.

### Client read

Client may list own Results when Assignment is `IN_PROGRESS` or `COMPLETED` and Execution exists.

### Trainer read

Trainer may list Results only when:

- Assignment Relationship `trainer_id == current_trainer`;
- Assignment status is `COMPLETED`;
- Execution exists and `completed_at IS NOT NULL`.

Relationship may be terminated. Trainer is read-only.

Other Trainer/Client access is hidden as `404 ASSIGNMENT_NOT_FOUND`.

## Concurrency

PUT is a resource upsert keyed by the composite primary key.

Transaction lock order remains:

`Account → Relationship → Assignment → Execution`.

After the Execution lock, PostgreSQL performs:

```sql
INSERT ...
ON CONFLICT (execution_id, block_position, exercise_position, set_index)
DO UPDATE SET
  actual_reps = EXCLUDED.actual_reps,
  actual_weight_kg = EXCLUDED.actual_weight_kg;
```

Properties:

- repeated identical PUT => one row;
- concurrent first PUT => one row;
- correction updates same row;
- simultaneous different corrections serialize on Execution row lock; last committed transaction is authoritative;
- no Result revision field and no `request_id`.

DELETE runs under the same parent lock order and deletes by natural key; missing row is a successful no-op.

## Error contract

- `403 ROLE_NOT_ALLOWED` — Trainer or other non-Client mutation attempt
- `404 ASSIGNMENT_NOT_FOUND` — missing or foreign Assignment/resource scope
- `404 EXECUTION_NOT_FOUND` — own Assignment has no Execution
- `404 RESULT_COORDINATE_NOT_FOUND` — positive coordinate is not a valid frozen occurrence/planned set
- `409 ASSIGNMENT_RESULTS_NOT_MUTABLE` — Client mutation/read outside `IN_PROGRESS|COMPLETED`
- `409 EXECUTION_NOT_COMPLETED` — own Trainer read before completed Execution
- `422` — request/path validation, including negative coordinates or body with both actual values null

## History and details

Workout History endpoints remain unchanged. History items do not embed Results. When a history/detail view opens an Assignment, Results are loaded by `assignment_id` through the Results GET endpoint.

Existing `GET /api/v1/assignments/{assignment_id}` remains authoritative for the frozen full snapshot.

## Tests

Required coverage:

- duplicate exercise source in two frozen snapshot occurrences;
- invalid block/exercise/set coordinates;
- first save;
- reps-only;
- weight-only;
- reps=0;
- correction while IN_PROGRESS;
- correction while COMPLETED;
- correction after Relationship termination;
- completion with zero Results;
- repeated identical PUT;
- concurrent first PUT;
- concurrent different correction, last committed wins;
- DELETE then missing;
- repeated DELETE;
- Trainer mutation forbidden;
- Trainer completed historical read allowed;
- foreign Trainer/Client hidden;
- current Workout modification does not affect mapping;
- migration `0008 → 0009 → 0008 → 0009`;
- authoritative OpenAPI paths, operation IDs and schemas;
- full PostgreSQL regression suite.
