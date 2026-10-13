# Execution ledger — plan: DOC/plans/2026-10-13-clients-crm-plan.md

Branch: codex/clients-crm; execution inline, current checkout as explicitly selected by owner.
No commit/push/deploy authorized.
Pre-flight: Task 1 cards feed Task 2 invite; Task 2 token feeds Task 3 mail and Task 5 onboarding; Task 4 summary feeds Task 6 UI; generated Task 5 DTOs feed Task 6. Signatures consistent.
Ruling: use native PowerShell/tool execution and this tracked ledger instead of Bash-only skill helper scripts on Windows; preserves progress without adding execution dependencies.
Tasks 1–6: implementation delivered locally; PostgreSQL migration/concurrency and live SMTP acceptance remain unverified prerequisites for release.
Ruling: execution in current checkout/feature branch per explicit owner choice; no commits despite skill defaults, because PROJECT_MEMORY local-first rule prohibits them without separate authorization.
Ruling: separate card_repository/card_service/card_router/join_service files within clients, plus typed frontend state and one CRM component. Lightweight forms/details are kept together for this first slice rather than introducing extra component interfaces.
Ruling: token transferred through URL fragment, including auth and email verification context, so it does not reach access logs. Accepted architecture is preserved; actual registration email verification remains mandatory.
Ruling: Windows sandbox async event loop/Node realpath prevented baseline execution; same tests pass with approved local unsandboxed execution. Do not bypass Windows Application Control blocking asyncpg DLL.
Ruling: SQL-only migration verified; unavailable Docker/PostgreSQL prevents application and real lock races. Integration test added and skipped honestly.
Ruling: equivalent focused tests replace some exact proposed plan test names; actual PostgreSQL/data delivery tests cannot be claimed complete.
Final review: fresh reviewer crm_review examined diff and untracked sources. Important: stale invitation ORM state → populate_existing on locked reads, reproduced independently and verified by real SQLAlchemy identity-map test. Important: legacy acceptance invisibility → transactionally link/create card before invitation lock. Important: wrong-account login loses context → preserved fragment link. User-visible late selection/program-load issues regraded Important and fixed with failing component tests → green.
Task 7: automated verification complete: backend 146 passed/76 skipped; frontend 88 passed; Ruff/ESLint/tsc and mypy new modules green. SQL generation passed. Live PostgreSQL/SMTP/mobile manual E2E pending environment readiness; no deployment.
