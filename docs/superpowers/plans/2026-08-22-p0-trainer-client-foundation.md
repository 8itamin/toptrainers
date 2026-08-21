# P0 Trainer–Client Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Invitation → Relationship persistence/APIs plus BTR-P0-01 v2 with PostgreSQL-safe concurrency.

**Architecture:** Add a `clients` module inside the existing FastAPI modular monolith. Mutations are implemented in service functions over one AsyncSession transaction; repositories contain only database access/locking; identity calls the public clients service for P0 footprint checks and role-change invitation cancellation.

**Tech Stack:** Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2 async, asyncpg/PostgreSQL, Alembic, pytest/pytest-asyncio/httpx.

**Spec:** `docs/superpowers/specs/2026-08-22-p0-trainer-client-foundation-design.md`

## Global Constraints
- Original P0 base commit: `222af3849f5dc837064db48da16cad78ee612481`; backend quality cleanup was later merged to main before final PR verification.
- Lock order: `Account → Invitation → Relationship`.
- Permanent Client footprint is Relationship-only; Invitation alone never blocks BecomeTrainer.
- Successful BecomeTrainer cancels all inbound PENDING Invitations in the same DB transaction with reason `CLIENT_ROLE_CHANGED_TO_TRAINER`.
- No Assignment/Execution, invitation expiry/transport/discovery, dual-role, role history, temporary footprint tables/flags, EXPIRED status, or Program/Workout changes.
- Do not delete historical Invitation/Relationship records.
- FastAPI generated OpenAPI remains the single HTTP source of truth.
- No new third-party dependencies.

---

### Task 1: Domain contracts and persistence model
**Files:** create `clients/{models,schemas}.py`; create migration `20260822_0005_p0_trainer_client_foundation.py`; modify `migrations/env.py`.
**Produces:** InvitationStatus, RelationshipStatus, TrainerClientInvitation, TrainerClientRelationship, request/response DTOs, DB constraints/indexes and Invitation resolution metadata (`resolved_at`, `resolved_by_account_id`, `resolution_reason`).
- [x] Write failing model/schema tests.
- [x] Run tests and verify RED.
- [x] Implement enums, models, schemas and additive migration.
- [x] Re-run model/schema tests.

### Task 2: Repository locking and footprint queries
**Files:** create `clients/repository.py`.
**Produces:** account/invitation/relationship lock queries; Relationship-only `has_client_p0_footprint`; bulk inbound pending-invitation cancellation without an internal commit.
- [x] Write failing repository/service contract tests.
- [x] Verify RED.
- [x] Implement minimal queries using `SELECT ... FOR UPDATE`, `exists` and transactional bulk `UPDATE`.
- [x] Re-run tests.

### Task 3: Transactional invitation/relationship services
**Files:** create `clients/service.py`; tests under `backend/tests/`.
**Produces:** `create_invitation`, `accept_invitation`, `reject_invitation`, `cancel_invitation`, `terminate_relationship`, Relationship-only `has_client_p0_footprint`, role-change cancellation contract.
- [x] Write lifecycle/idempotency/permission tests first.
- [x] Verify RED on PostgreSQL test DB.
- [x] Implement services with Account → Invitation → Relationship lock order.
- [x] Verify GREEN.

### Task 4: HTTP router and typed business error mapping
**Files:** create `core/errors.py`, `clients/router.py`, `clients/__init__.py`; modify `app/router.py`.
**Produces:** five `/clients/...` endpoints and typed `detail.code/detail.message` 4xx OpenAPI responses.
- [x] Write HTTP contract and permission/error tests.
- [x] Implement router/error helpers and mount router.
- [x] Verify generated OpenAPI and HTTP boundary tests.

### Task 5: BTR-P0-01 v2
**Files:** modify `identity/router.py`; tests `test_become_trainer_p0.py`, `test_btr_v2.py`.
**Produces:** Client Account row lock; Relationship-only permanent-footprint guard; transactional cancellation of inbound PENDING Invitations; preserved `409 BECOME_TRAINER_P0_FOOTPRINT_EXISTS`; losing Accept `409 INVITATION_CANCELLED_BY_ROLE_CHANGE`; unchanged session rotation.
- [x] Write BTR-V2-01…11 before production changes.
- [x] Verify RED against v1 semantics: CI run #46 = 8 failed / 57 passed.
- [x] Implement v2 transaction contract.
- [x] Verify GREEN.

### Task 6: Concurrency suite
**Files:** `test_clients_concurrency.py`, `test_btr_v2.py`.
**Produces:** PostgreSQL races for double invitation, Accept vs Cancel, double Accept, concurrent termination, CreateInvitation vs BecomeTrainer and deterministic Accept-vs-BecomeTrainer winner cases.
- [x] Use independent AsyncSessions/connections.
- [x] Deterministically prove Accept-wins and BecomeTrainer-wins outcomes through Client Account row locking.
- [x] Verify coherent final states and no infrastructure locks.

### Task 7: Migration, documentation and final verification
**Files:** `DOC/DECISIONS.md`, design spec, Alembic roundtrip tests.
- [x] Rewrite existing ADR-013 to BTR-P0-01 v2; do not add a new ADR.
- [x] Keep resolution columns inside unmerged migration `20260822_0005`; no new migration.
- [x] Verify PostgreSQL Alembic `upgrade → downgrade → upgrade`, including v2 Invitation columns.
- [x] Run repository-wide `ruff check .` and `mypy src` in CI.
- [x] Run full PostgreSQL suite including P0 races.
- [x] Final CI run #60: backend tests 65 passed, backend quality PASS, frontend PASS.
