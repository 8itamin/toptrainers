# Program Tasks and S3 Media — Design

**Date:** 2026-09-22  
**Status:** approved design; implementation plan pending review

## Goal

Extend the trainer's program, workout, and task interfaces into a single reliable feature: trainers create typed task templates; tasks are scheduled as a program-day item or inside a workout; issuing materializes immutable client task assignments; client submissions append versioned results; and private S3 stores submitted images.

## Binding decisions

- Task template fields are typed `completion`, `measurement`, `photo`, and `note`; each enabled field has a required flag and every template enables at least one.
- A program day may contain ordered `WORKOUT` and `TASK` items. A workout may contain ordered task steps distinct from exercises.
- Issued assignments keep frozen snapshots. Completing a workout does not complete or block any task.
- Task result versions are append-only. A client may submit a correction while the relationship is active; terminated relationships are read-only.
- S3 objects are private. JPEG, PNG, and WebP up to 10 MiB upload with short-lived presigned URLs. The API stores server-generated object keys and never exposes credentials or object keys in normal responses.
- API models are FastAPI/OpenAPI-authoritative and Angular types are generated from them.

## Verification

Cover migration compatibility, mixed scheduling, immutable snapshots, version/idempotency races, ownership/relationship checks, media MIME/size/ownership enforcement, task/workout independence, generated contract drift, and the full backend/frontend quality gates.
