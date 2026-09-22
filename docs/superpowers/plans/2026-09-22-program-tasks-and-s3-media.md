# Program Tasks and S3 Media Implementation Plan

**Goal:** Deliver typed program/workout tasks with append-only client results and private S3 images.

**Architecture:** The `tasks` module owns templates, assignments, result versions, and media ownership. Programs gain ordered polymorphic schedule items; workouts gain task steps; assignments materialize frozen task snapshots atomically.

**Spec:** `docs/superpowers/specs/2026-09-22-program-tasks-and-s3-media-design.md`

## Tasks

- [ ] Add task persistence, schemas, `20260922_0011` migration, router, model/migration tests, and S3 dependency.
- [ ] Evolve program slots into ordered workout/task schedule items, migrate existing slots at position zero, and extend workouts with ordered task steps.
- [ ] Materialize standalone and workout-embedded task assignments with frozen snapshots; add cancellation, authorization, append-only/idempotent versions, and concurrency coverage.
- [ ] Add private S3 presigning, confirmation, safe media ownership, typed FastAPI routes, OpenAPI export, and contract tests.
- [ ] Generate Angular task contracts and implement typed data-access APIs.
- [ ] Replace trainer library/editor mock data with API-backed templates, mixed schedule items, and workout task controls.
- [ ] Connect client/trainer task screens to submitted result versions, upload progress, history, and independent workout completion state.
- [ ] Run backend/frontend full gates and update project memory/roadmap; do not commit, push, or deploy before owner approval.
