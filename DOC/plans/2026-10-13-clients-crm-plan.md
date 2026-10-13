# Clients CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for inline execution or superpowers:subagent-driven-development if the owner selects delegation. Steps use checkbox syntax for tracking.

**Goal:** Создать рабочую CRM тренера с карточками до регистрации, приглашениями и реальными программами/историей.

**Architecture:** clients владеет карточкой и приглашением подключения; identity владеет аккаунтом и подтверждением email. После принятия создаётся существующая Relationship; assignments остаётся владельцем назначения и истории. UI использует генерируемые OpenAPI DTO.

**Tech Stack:** FastAPI, SQLAlchemy/Alembic, PostgreSQL, Redis, SMTP; Angular/Nx, RxJS, Vitest.

**Spec:** `DOC/specs/2026-10-13-clients-crm-design.md` (утверждена 2026-10-13).

## Global Constraints

- Имя обязательно, 1–120 символов; email необязателен.
- Приглашение одноразовое, действует 7 дней; новое отменяет прежнее.
- Программу можно назначить только после принятия.
- Account → Card → JoinInvitation → Invitation → Relationship; роль проверяется под блокировкой Account.
- Нет прямого импорта чужих repository, переписывания snapshots или использования arc/.
- Только локальная поставка; commit/push/deploy требуют отдельного поручения.
- Сохраняем текущие зависимости и стиль интерфейса; персональные данные и секреты не записываем в Git.

## Review Focus

1. Подтверждение email в новой вкладке не должно терять приглашение.
2. Двойное нажатие «Принять» не создаёт вторую связь.
3. Ошибка SMTP после commit оставляет доступную карточку и честную ошибку доставки.
4. Переключение карточки во время запроса не показывает историю другого клиента.
5. Старые повторные/завершённые связи дают одну карточку с полной историей.

## Task 1: Модель CRM и миграция

**Files:** modify `backend/src/toptrainers_api/modules/clients/{models,schemas,repository,service,router}.py`; create `backend/migrations/versions/20261013_0018_client_cards.py`, `backend/tests/test_client_cards.py`, `backend/tests/test_client_cards_migration.py`. Modify `backend/src/toptrainers_api/modules/identity/service.py` for public contact read contract.

**Interfaces:** `identity.service.get_account_contact(session, account_id) -> AccountContact | None` returns id/email/role/verification state. `clients.service.create_card(session, trainer_id, payload) -> TrainerClientCard`; `list_cards(session, trainer_id, group, query, cursor, limit) -> ClientCardPage`; `get_card(session, trainer_id, card_id) -> TrainerClientCard`; `update_card(session, trainer_id, card_id, payload) -> TrainerClientCard`.

- [ ] Write tests: `test_create_card_without_account` asserts trimmed name, null account and no Relationship; `test_duplicate_email_is_owner_scoped` asserts one normalized contact per trainer; `test_foreign_card_is_not_found` asserts 404; `test_backfill_repeated_relationships` asserts one card and unchanged relationships.
- [ ] Run `python -m pytest tests/test_client_cards.py tests/test_client_cards_migration.py` in backend; confirm failure before implementation.
- [ ] Add Card and JoinInvitation tables with UUID IDs, timestamps, trainer ownership, unique nonnull trainer/account and normalized trainer/email, token_hash unique, states PENDING/ACCEPTED/CANCELLED. Define responses and request validators; paginate by stable id with limit 1–100, default 30. Expiry is derived from expires_at; do not require a background job.
- [ ] Implement `/clients/cards` GET/POST and `/clients/cards/{card_id}` GET/PATCH. Response includes id/name/email/account_id/current relationship/status/timestamps; list includes items/next_cursor/counts. Resolve current relationship using newest ACTIVE pair. Reject email edits while active invitation or linked account exists.
- [ ] Backfill existing pair contacts using accounts.email with no changes to historical relationships. Verify migration upgrade on empty PostgreSQL and fixture database at revision 0017; document unavailable database honestly.
- [ ] Run tests and Ruff on modified Python files; expected all pass.

## Task 2: Одноразовая ссылка и атомарное принятие

**Files:** create `backend/src/toptrainers_api/modules/clients/join_service.py`, `backend/tests/test_client_join.py`, `backend/tests/test_client_join_concurrency.py`; modify clients models/repository/schemas/router/service and identity service public account lock contract.

**Interfaces:** `issue_join_invitation(session, trainer_id, card_id) -> IssuedJoinInvitation` returns invitation metadata and raw token once; `cancel_join_invitation(session, trainer_id, card_id) -> None`; `preview_join_invitation(session, token) -> JoinPreview`; `accept_join_invitation(session, account_id, token) -> RelationshipResponse`.

- [ ] Write tests: token lifetime exactly timedelta(days=7), DB stores SHA-256 hash only; preview does not consume; expired/cancelled rejects; email mismatch and trainer role reject; same-account retry returns original relationship even after its termination; foreign-account retry rejects. `test_accept_races_cancel_and_become_trainer` verifies one winner and no inconsistent state using PostgreSQL transactions.
- [ ] Run new tests; verify failure.
- [ ] Refactor existing account-bound accept into a transaction-safe internal helper (no nested commit), preserving existing endpoint semantics. Implement join accept with Account-first lock, card and invitation rechecks, verified role/email, atomic account linking and creation/resolution of compatible legacy Invitation/Relationship. Reject duplicate account contact rather than attaching it twice.
- [ ] Add POST `/clients/cards/{card_id}/invite`, POST `/clients/cards/{card_id}/invite/cancel`, POST `/clients/join/preview` and POST `/clients/join/accept`; token travels in JSON body. Add Redis limits to preview/accept and invite issuance, 30 previews/15 minutes and 5 issuances/hour per actor/card. Error DTOs have stable codes and no raw token.
- [ ] Run join, concurrency and existing clients/identity tests; expected pass, no changed ADR-013 behavior.

## Task 3: SMTP и приглашение через email

**Files:** create `backend/src/toptrainers_api/core/mail.py`, `backend/src/toptrainers_api/modules/clients/invitation_mail.py`, `backend/tests/test_client_invitation_mail.py`; modify identity/service.py and clients/router.py.

**Interfaces:** `core.mail.send_email(recipient: str, subject: str, html: str) -> None` async; `invitation_mail.send_client_invitation(recipient, display_name, raw_token) -> None`. Existing identity verification/reset callers use same transport.

- [ ] Tests `test_smtp_failure_preserves_invitation` asserts committed contact remains and response reports delivery failure; `test_invite_mail_escapes_name` asserts escaped markup; `test_invite_origin_uses_config` asserts configured public_app_url, never incoming Host. Verify identity mail tests remain valid.
- [ ] Run mail tests and observe failure.
- [ ] Extract SMTP transport unchanged into core/mail.py. Add POST `/clients/cards/{card_id}/invite/email`: issue/commit invitation, send email, return token/link metadata plus delivery status SENT/FAILED and safe failure message. Missing email rejects before issuance; retries create a new invitation. Do not auto-send during card creation.
- [ ] Run mail and identity security tests; expected pass. Real delivery is an explicit manual check using configured local/test SMTP, never actual customer addresses without authorization.

## Task 4: Реальные назначения и показатели карточки

**Files:** modify `backend/src/toptrainers_api/modules/assignments/{service,repository,schemas,router}.py`; create `backend/tests/test_client_crm_summary.py`; modify clients/service.py only if needed for public relationship authorization contract.

**Interfaces:** `assignments.service.get_trainer_client_summary(session, trainer_id, client_id) -> TrainerClientSummary`; GET `/clients/{client_id}/training-summary` owned by assignments router. Summary contains programs (id, frozen title, start date, status, completed/noncancelled counts), total completed workouts and last_completed_at.

- [ ] Tests `test_summary_is_pair_scoped`, `test_cancelled_children_excluded`, `test_zero_denominator_is_null`, `test_terminated_pair_keeps_history` assert privacy, null percentage, frozen titles and historical access. Verify repeated relationships aggregate without double counting.
- [ ] Run tests; verify failure.
- [ ] Implement read projection over existing assignments/executions/program snapshots; use public clients relationship service for authorization. Existing program issue and terminate endpoints remain authoritative; no CRM-specific bypass.
- [ ] Run summary, assignment/program issuance and history tests; expected pass.

## Task 5: Генерируемый контракт и клиентский онбординг

**Files:** create `frontend/tools/openapi/generate-clients.mjs`, `frontend/libs/shared/contracts/src/generated/clients.ts`, `frontend/libs/shared/data-access/src/lib/clients.ts`, `frontend/libs/pwa/feature-role-shell/src/lib/client-join.component.ts`, `frontend/libs/pwa/feature-role-shell/src/lib/client-invitation-context.ts`, associated `.test.ts`; modify generate-all.mjs, contracts/data-access exports, auth.component.ts, auth-action.component.ts, feature-role-shell exports and `frontend/apps/app/src/app/app.routes.ts`.

**Interfaces:** `ClientsApi` provides list/create/update/invite/sendEmail/cancelInvite/preview/accept/summary methods using generated DTOs. Join route `/client-invite` is public with explicit authentication for accept. `client-invitation-context.ts` validates/preserves only same-origin invite context, never arbitrary return URLs.

- [ ] Tests `test_join_survives_email_verification_new_tab` covers server-issued verification link including validated invite context, not only sessionStorage; `test_join_rejects_external_return_url` rejects external redirect; `test_accept_requires_explicit_click` ensures no mutation on load. Test contract generator output against OpenAPI schemas and operation paths.
- [ ] Run targeted Vitest tests; verify failure.
- [ ] Extend registration schema with optional invitation context verified server-side against unexpired invitation; include only validated invite token in verification link and preserve it through UI transitions. Keep email verification mandatory and auth cookies unchanged. Registration from join defaults to client; do not auto-change existing role. Add referrer policy for invite page and avoid token logging/storage in persistent localStorage.
- [ ] Generate backend OpenAPI with `python scripts/export_openapi.py`, then frontend `pnpm api:generate`. Implement ClientsApi and join screen with pending/busy/error/accepted/expired states, role/email mismatch explanation and explicit accept.
- [ ] Run targeted tests and `pnpm typecheck`; expected pass.

## Task 6: CRM тренера

**Files:** modify `frontend/libs/pwa/feature-role-shell/src/lib/trainer-clients.component.ts`; create `trainer-client-card.component.ts`, `trainer-client-form.component.ts`, `trainer-clients-state.ts` and corresponding `.test.ts`. Reuse TrainerSidebarComponent, ProgramsApi and WorkoutHistoryApi.

**Interfaces:** state owns selected card, query/group/cursor and request generation; card receives typed card/summary/history and emits issue/terminate/edit/invite actions. UI labels follow approved spec.

- [ ] Tests `test_late_response_does_not_replace_selected_client`, `test_pending_card_cannot_issue_program`, `test_email_failure_offers_retry`, `test_issue_reuses_request_id_after_network_error` cover request races, restrictions, delivery and idempotent program issue.
- [ ] Run targeted Vitest tests; verify failure.
- [ ] Replace CLIENTS/FILTERS demo data with paginated API, real counters and debounced search. Add create/edit form and invitation actions; Telegram share uses encoded text/url, explicit button and clipboard fallback. Warn before replacing invitation.
- [ ] Implement details with ProgramsApi.issue using saved nonempty program, local start date and stable request_id across retry; refresh summary after success. Use real paginated pair history, empty states and null metrics. Terminate with confirmation and refresh groups.
- [ ] Disable mutations offline; display recoverable loading/error states. Use desktop side panel and mobile full-width details/back action with accessible labels, focus and navigation.
- [ ] Run targeted tests, `pnpm typecheck`, `pnpm lint`, `pnpm nx build app`; expected pass.

## Task 7: Сквозная проверка и документация

**Files:** modify `DOC/PROJECT_MEMORY.md`, `DOC/DECISIONS.md`, `DOC/ROADMAP.md`; add `DOC/runbooks/clients-crm-local-check.md` with steps and actual evidence, no credentials or customer data.

- [ ] Run backend `python -m pytest`, `python -m ruff check src tests`; record failures or unavailable prerequisites explicitly.
- [ ] Run frontend `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm nx build app`; avoid repeating checks unless changes invalidate results.
- [ ] Walk through local trainer create → email/test SMTP or Telegram share → new client register/verify/accept → assign → client complete → trainer history; repeat with existing account and cancelled/expired invitation. Check mobile view, keyboard forms and browser refresh.
- [ ] Inspect whole diff for privacy, owner scoping, lock order, SMTP errors, migration compatibility and accidental archive edits. Obtain independent final code review using available review tool if possible; address findings and rerun affected checks.
- [ ] Document actual completed scope and limitations, mark approved architectural decision in ADR, update roadmap milestone. Do not claim manual delivery or PostgreSQL races verified without executing them.
- [ ] Deliver local result and verification summary. No commit/push/deploy without explicit owner request.
