# Training Programs v1

## Scope

Evolve the existing `Program` model into a mutable training schedule and issue it as an immutable parent `ProgramAssignment` with standard frozen `WorkoutAssignment` children.

## API

- `Program` requests and responses expose `duration_weeks`; it remains stored in the existing `programs.weeks` column.
- A program contains a complete `slots` schedule. A `PUT /programs/{program_id}` replaces that schedule under a Program row lock.
- `POST /programs/{program_id}/assignments` accepts `client_id`, `start_date`, and parent `request_id`.
- `POST /program-assignments/{program_assignment_id}/cancel` cancels the parent and only its PLANNED child assignments.

Each slot has `week_number`, `day_number`, and `workout_id`. Its child date is `start_date + (week_number - 1) * 7 + (day_number - 1)`.

## Persistence

Migration `20260906_0010_training_programs_v1` adds `program_slots`, `program_assignments`, and nullable parent/slot provenance columns to `workout_assignments`. It keeps the physical `programs.weeks` column.

`program_slots` has unique `(program_id, week_number, day_number)`. A parent stores an immutable schema-v1 JSONB schedule of slot coordinates and Workout IDs; it deliberately excludes mutable Workout content. Children retain their existing schema-v1 frozen Workout snapshot.

## Issuance and concurrency

Program edit and issuance lock the Program row. Issuance also locks the active relationship, validates every slot and owned Workout, creates the parent and all children through a shared commit-free assignment materializer, then commits once. The parent `request_id` is unique within its relationship; a matching retry returns the original parent and a mismatch returns 409. Backend-generated child request IDs remain internal.

Parent cancellation shares the relationship-before-parent-before-child lock order with child lifecycle work. It updates only PLANNED children, so Start may win a race for one child without corrupting the rest.

## Verification

Tests cover schema constraints, validation and ownership, exact atomic issuance and date mapping, immutable parent/child snapshots, idempotency, Edit-vs-Assign and Cancel-vs-Start races, parent cancellation, and unchanged direct-assignment, history, results, and relationship-termination behavior. Migration upgrade/downgrade assessment documents that downgrading after production issuance is destructive.
