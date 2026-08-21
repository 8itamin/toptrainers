# P0 Trainer–Client Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Invitation → Relationship persistence/APIs plus BTR-P0-01 with PostgreSQL-safe concurrency.

**Architecture:** Add a `clients` module inside the existing FastAPI modular monolith. Mutations are implemented in service functions over one AsyncSession transaction; repositories contain only database access/locking; identity calls the public clients service for P0 footprint checks.

**Tech Stack:** Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2 async, asyncpg/PostgreSQL, Alembic, pytest/pytest-asyncio/httpx.

**Spec:** `docs/superpowers/specs/2026-08-22-p0-trainer-client-foundation-design.md`

## Global Constraints
- Base commit: `222af3849f5dc837064db48da16cad78ee612481`.
- Lock order: `Account → Invitation → Relationship`.
- No Assignment/Execution, invitation expiry/transport/discovery, dual-role, role history, temporary footprint tables/flags, or Program/Workout changes.
- Do not delete historical Invitation/Relationship records.
- FastAPI generated OpenAPI remains the single HTTP source of truth.
- No new third-party dependencies.

---

### Task 1: Domain contracts and persistence model
**Files:** create `clients/{models,schemas}.py`; create migration `20260822_0005_p0_trainer_client_foundation.py`; modify `migrations/env.py`.
**Produces:** InvitationStatus, RelationshipStatus, TrainerClientInvitation, TrainerClientRelationship, request/response DTOs, DB constraints/indexes.
- [ ] Write failing model/schema tests.
- [ ] Run tests and verify RED.
- [ ] Implement enums, models, schemas and additive migration.
- [ ] Re-run model/schema tests.

### Task 2: Repository locking and footprint queries
**Files:** create `clients/repository.py`; modify `identity/service.py` only if a reusable account-lock service is needed.
**Produces:** account/invitation/relationship lock and existence queries; `has_client_p0_footprint` query support.
- [ ] Write failing repository/service contract tests.
- [ ] Verify RED.
- [ ] Implement minimal queries using `SELECT ... FOR UPDATE` and `exists`.
- [ ] Re-run tests.

### Task 3: Transactional invitation/relationship services
**Files:** create `clients/service.py`; test `test_clients_integration.py`.
**Produces:** `create_invitation`, `accept_invitation`, `reject_invitation`, `cancel_invitation`, `terminate_relationship`, `has_client_p0_footprint`.
- [ ] Write lifecycle/idempotency/permission tests first.
- [ ] Verify RED on PostgreSQL test DB.
- [ ] Implement services with Account → Invitation → Relationship lock order.
- [ ] Verify GREEN.

### Task 4: HTTP router and typed business error mapping
**Files:** create `core/errors.py`, `clients/router.py`, `clients/__init__.py`; modify `app/router.py`.
**Produces:** five `/clients/...` endpoints and typed `detail.code/detail.message` 4xx OpenAPI responses.
- [ ] Write HTTP contract tests first.
- [ ] Verify RED.
- [ ] Implement router/error helpers and mount router.
- [ ] Verify GREEN and exported OpenAPI.

### Task 5: BTR-P0-01
**Files:** modify `identity/router.py`; test `test_become_trainer_p0.py`.
**Produces:** client Account row lock, footprint guard, `409 BECOME_TRAINER_P0_FOOTPRINT_EXISTS`, preserved trainer idempotency/session rotation semantics.
- [ ] Write BTR guard tests first.
- [ ] Verify RED.
- [ ] Implement lock + public clients service call.
- [ ] Verify GREEN.

### Task 6: Concurrency suite
**Files:** test `test_clients_concurrency.py`.
**Produces:** PostgreSQL tests for double invitation, Accept vs Cancel, double Accept, concurrent termination, CreateInvitation vs BecomeTrainer.
- [ ] Write each race test with two independent AsyncSessions/connections.
- [ ] Verify pre-fix race/failure where applicable.
- [ ] Run all race tests after implementation and assert one coherent final state.

### Task 7: Documentation and verification
**Files:** modify `DOC/DECISIONS.md`, `DOC/PROJECT_MEMORY.md` after implementation is locally verified; no CI/workflow changes in Backend scope.
- [ ] Add follow-up ADR that narrows ADR-012 with BTR-P0-01.
- [ ] Record P0 foundation completion in project memory.
- [ ] Run `ruff check .`, `mypy src`, `pytest` in a PostgreSQL-enabled project environment.
- [ ] Export OpenAPI and verify the 409 business-error contracts.
- [ ] Do not commit/push/deploy until owner explicitly approves the verified local result.
