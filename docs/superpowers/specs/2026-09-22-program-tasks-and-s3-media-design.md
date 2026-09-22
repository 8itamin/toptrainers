# Program Tasks and S3 Media — Design

**Date:** 2026-09-22  
**Status:** approved design; implementation plan pending review

## Goal

Extend the trainer's program, workout, and task interfaces into a single reliable feature:

- a trainer creates typed task templates;
- a task is scheduled as an independent item of a program day or ordered inside a workout;
- issuing a program or a direct workout assignment materializes immutable client task assignments;
- a client submits number, photo, text, and/or completion evidence;
- each submission appends an immutable result version visible to the trainer;
- a task never blocks a workout from completing.

## Scope and exclusions

Included: task templates, program schedule items, workout task steps, issued task assignments, versioned client results, private S3 image upload through presigned URLs, trainer/client task views, generated OpenAPI contracts, migrations, and tests.

Excluded: arbitrary task code, arbitrary form schemas, notifications, due-date escalation, realtime, offline mutation queue, moderation workflow, video files, task analytics, and automatic trainer approval.

## Domain model

### Task templates

The `tasks` backend module owns `TaskTemplate`. A template belongs to one trainer and is safe typed data, not user HTML or executable code.

Each template has a title, optional instruction, and an explicit result schema. The first version supports fixed result fields:

- `completion`: boolean acknowledgement;
- `measurement`: non-negative decimal plus a required unit such as `cm` or `kg`;
- `photo`: one or more image references;
- `note`: bounded plain text.

Each enabled field specifies whether it is required. A template must enable at least one field. Existing issued assignments never follow later edits of their template.

### Placement

`ProgramSlot` evolves into an ordered program schedule item. A day may contain multiple items, each with `position` and exactly one target:

- `WORKOUT`, referencing one trainer-owned workout; or
- `TASK`, referencing one trainer-owned task template.

The existing unique `(program_id, week_number, day_number)` constraint becomes `(program_id, week_number, day_number, position)`. Existing slots migrate to `WORKOUT` items at position `0` without changing issued program snapshots.

`WorkoutTask` is an ordered typed step in a workout. It is not an exercise and does not participate in workout set/result coordinate identity. It references a task template while editable; each issued workout assignment stores the required frozen task snapshot.

### Assignments and results

`TaskAssignment` is the client-facing immutable work item. It stores relationship ownership, scheduled date, frozen task snapshot, optional provenance to a program assignment/schedule item, and optional provenance to a workout assignment/workout-task. It has `PENDING`, `COMPLETED`, or `CANCELLED` status.

Task assignments are materialized in the same transaction as their parent:

- issuing a program materializes standalone day tasks and child workout tasks;
- directly assigning a workout materializes its child workout tasks;
- cancelling a program cancels only its pending task assignments and planned workout children; existing results remain available.

`TaskResultVersion` is append-only and uses a per-assignment monotonically increasing integer version. A successful submission marks the assignment `COMPLETED`; a later correction creates the next version and keeps it completed. No prior result is mutated or deleted.

## Media and S3

Task-result images use the configured S3-compatible storage through a new small media boundary. The bucket is private.

1. The authenticated client asks the API for a presigned upload URL for an allowed image.
2. The API validates task-assignment ownership, allowed MIME type (`image/jpeg`, `image/png`, `image/webp`) and a 10 MiB limit, then records a pending owned media object and returns a short-lived PUT URL.
3. The client uploads directly to S3 and confirms the object with the API.
4. A result version may reference only confirmed media owned by that client and assignment.
5. A trainer or client asks the API for a short-lived read URL; object keys and storage credentials never appear in normal responses.

The application uses `TT_S3_ENDPOINT_URL`, `TT_S3_BUCKET`, `TT_S3_REGION`, `TT_S3_ACCESS_KEY_ID`, and `TT_S3_SECRET_ACCESS_KEY` from untracked environment configuration. No secret is added to Git or OpenAPI.

## Authorization and lifecycle

- Trainers can manage only their templates and program/workout placements.
- Clients can list and submit versions only for their own non-cancelled task assignments while the trainer-client relationship is active.
- Trainers can view only task assignments and version history belonging to their own client relationship.
- Completed tasks may receive new versions while the relationship is active.
- After a relationship terminates, both parties retain read-only history; no new version is accepted.
- A task is independent of workout completion. Starting, completing, or correcting a workout has no task-status side effect.

Transaction locking follows the existing owner chain: `Account -> Relationship -> ProgramAssignment/WorkoutAssignment -> TaskAssignment`. Version allocation locks the task assignment before reading the latest version, so concurrent submissions produce distinct consecutive versions.

## HTTP contract

FastAPI remains authoritative. The API exposes typed CRUD for templates, schedule and workout-task write shapes, client task-assignment list/detail/result submission, trainer client-result list/detail, and media upload/confirmation/read-link endpoints. Every generated TypeScript model is produced from the checked-in OpenAPI schema; no DTO is duplicated manually in Angular.

Result submissions have a client `request_id` for idempotency. Repeating the request returns the original version. A different request ID always creates a new version after validation.

## Frontend integration

The existing Angular screens are retained and connected to APIs instead of their local demo arrays:

- Library: Exercises, Workouts, Programs, Tasks;
- exercise editor and workout constructor;
- program schedule with ordered mixed workout/task items;
- trainer task list with latest result and history;
- client task list/detail with field-based form, upload progress, version history, loading, empty, error, and offline-disabled states.

The current PWA is not granted background file upload or offline result queue in this scope. It must clearly explain when a connection is required.

## Migration and compatibility

All migrations are additive or data-preserving forward migrations. Existing programs retain their workout slots as position-zero schedule items. Existing workout assignments, executions, set results, and history payloads do not change. Migration downgrade is not a production rollback mechanism after task/result writes; production release follows the existing backup gate.

## Verification

- PostgreSQL migration roundtrip and preservation of existing program slots;
- domain tests for frozen snapshots, materialization, cancellation, version allocation, and task/workout independence;
- HTTP tests for ownership, relationship status, idempotency, generated OpenAPI paths and schemas;
- media tests for MIME/size/ownership checks and presigned requests with a mocked S3 client;
- concurrency tests for simultaneous versions;
- Angular unit tests for mapping, forms, errors, and version history;
- full backend and frontend lint/typecheck/test/build gates.
