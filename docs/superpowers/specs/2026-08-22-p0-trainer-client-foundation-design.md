# P0 Trainer–Client Foundation Design

## Goal
Implement the first P0 trainer/client domain foundation: Invitation → Relationship plus the BTR-P0-01 client-to-trainer compatibility guard.

## Scope
- trainer_client_invitations with PENDING / ACCEPTED / REJECTED / CANCELLED.
- trainer_client_relationships with ACTIVE / TERMINATED.
- Relationship is created only by successful invitation acceptance.
- A terminated Relationship is never reactivated; new cooperation creates a new Relationship.
- At most one ACTIVE Relationship per trainer/client pair.
- Any Invitation or Relationship row where an account is client is permanent P0 footprint.
- CreateInvitation and BecomeTrainer serialize on the target client Account row.
- Lock order: Account → Invitation → Relationship.
- No Assignment/Execution, expiry, invitation transport/discovery, dual-role, role history, temporary footprint flags, or Program/Workout changes.

## Module boundary
A new `clients` domain module owns invitation/relationship models, schemas, repository, service, router and tests. `identity` may call the public `clients.service.has_client_p0_footprint()` contract, never `clients.repository` directly.

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
Required BTR code: `BECOME_TRAINER_P0_FOOTPRINT_EXISTS` with HTTP 409.

## Idempotency
- Accept on already ACCEPTED returns its existing Relationship.
- Reject on already REJECTED returns current Invitation.
- Cancel on already CANCELLED returns current Invitation.
- Terminate on already TERMINATED returns current Relationship.
- Conflicting terminal transitions return HTTP 409.
- Double CreateInvitation is prevented by a partial unique pending-pair index and mapped to HTTP 409.

## Persistence
Status values are strings protected by CHECK constraints rather than PostgreSQL enum types. History rows are never deleted by domain operations. Foreign keys to accounts and accepted invitation use restrictive/no-action deletion semantics.

## Concurrency
CreateInvitation locks target client Account before checking role/active relationship/pending invitation. BecomeTrainer locks the same Account before checking any client-side invitation/relationship footprint. Invitation state transitions lock Account, then Invitation, then Relationship when required. Unique partial indexes are the final race-safety backstop.
