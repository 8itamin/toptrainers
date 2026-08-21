# P0 Trainer–Client Foundation Design

## Goal
Implement the first P0 trainer/client domain foundation: Invitation → Relationship plus BTR-P0-01 v2 client-to-trainer compatibility rules.

## Scope
- `trainer_client_invitations` with PENDING / ACCEPTED / REJECTED / CANCELLED.
- `trainer_client_relationships` with ACTIVE / TERMINATED.
- Relationship is created only by successful invitation acceptance.
- A terminated Relationship is never reactivated; new cooperation creates a new Relationship.
- At most one ACTIVE Relationship per trainer/client pair.
- Permanent Client P0 footprint is the existence of any Relationship where the account is Client. Invitation alone is never permanent footprint.
- Successful BecomeTrainer cancels every inbound PENDING Invitation atomically with reason `CLIENT_ROLE_CHANGED_TO_TRAINER` before changing the role in the same transaction.
- CreateInvitation, AcceptInvitation and BecomeTrainer serialize on the target Client Account row.
- Lock order: Account → Invitation → Relationship.
- No Assignment/Execution, expiry, invitation transport/discovery, dual-role, role history, temporary footprint flags, EXPIRED status, or Program/Workout changes.

## Module boundary
The `clients` domain module owns invitation/relationship models, schemas, repository, service, router and tests. `identity` calls public `clients.service` contracts and does not import `clients.repository` directly.

## HTTP contract
- POST /clients/invitations
- POST /clients/invitations/{invitation_id}/accept
- POST /clients/invitations/{invitation_id}/reject
- POST /clients/invitations/{invitation_id}/cancel
- POST /clients/relationships/{relationship_id}/terminate

CreateInvitation takes `client_id`; trainer comes from the authenticated account.

## Error contract
Business conflicts use FastAPI's standard error envelope with typed detail:
`{"detail": {"code": "...", "message": "..."}}`.

Required BTR code: `BECOME_TRAINER_P0_FOOTPRINT_EXISTS` with HTTP 409 when any Client Relationship exists.
A losing Accept after system cancellation by successful BecomeTrainer returns HTTP 409 with `INVITATION_CANCELLED_BY_ROLE_CHANGE`.

## Invitation resolution metadata
Invitation history is never deleted. Resolution is persisted as:
- `resolved_at`: timestamp for ACCEPTED / REJECTED / CANCELLED resolution;
- `resolved_by_account_id`: actor for user-driven Accept / Reject / Cancel; NULL for system role-change cancellation;
- `resolution_reason`: NULL for ordinary user-driven resolution; `CLIENT_ROLE_CHANGED_TO_TRAINER` for system cancellation by BecomeTrainer.

## Idempotency
- Accept on already ACCEPTED returns its existing Relationship.
- Reject on already REJECTED returns current Invitation.
- Cancel on already CANCELLED returns current Invitation.
- Terminate on already TERMINATED returns current Relationship.
- Conflicting terminal transitions return HTTP 409.
- Double CreateInvitation is prevented by a partial unique pending-pair index and mapped to HTTP 409.

## Persistence
Status values are strings protected by CHECK constraints rather than PostgreSQL enum types. History rows are never deleted by domain operations. Foreign keys to accounts and accepted invitation use restrictive/no-action deletion semantics. The unmerged `20260822_0005` migration includes invitation resolution fields; no follow-up migration is created for v2.

## BecomeTrainer transaction
The successful transition is one database transaction:

1. `SELECT Account ... FOR UPDATE` for the Client.
2. Relationship-only permanent-footprint EXISTS check.
3. Bulk UPDATE all inbound PENDING Invitations to CANCELLED with system resolution metadata; no internal commit.
4. Set Account role to TRAINER.
5. Revoke previous sessions and create the replacement trainer session.
6. One COMMIT.

If a Relationship exists, the transaction returns `409 BECOME_TRAINER_P0_FOOTPRINT_EXISTS` before invitation cancellation or role/session changes.

## Concurrency
Accept and BecomeTrainer both acquire the same Client Account row first, so only one can establish the decisive state:
- Accept wins: it creates Relationship and commits while role remains CLIENT; waiting BecomeTrainer observes Relationship and returns 409.
- BecomeTrainer wins: it cancels pending inbound Invitations, changes role and commits; waiting Accept then locks the Invitation, sees system cancellation reason, and returns `409 INVITATION_CANCELLED_BY_ROLE_CHANGE`; no Relationship is created.

CreateInvitation also locks the target Client Account. If CreateInvitation wins first, BecomeTrainer subsequently cancels the new pending Invitation. If BecomeTrainer wins first, CreateInvitation observes TRAINER role and fails; no pending invitation remains for a trainer account.
