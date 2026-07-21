# TopTrainers — continuity rules

Before starting work, read:

1. `DOC/PROJECT_MEMORY.md`
2. `DOC/DECISIONS.md`
3. `DOC/ROADMAP.md`

The active repository is a polyglot monorepo:

- `frontend/` — Nx + Angular: one PWA and one SSR showcase;
- `backend/` — FastAPI modular monolith;
- `infra/` — Compose, gateway configuration and runbooks.

`arc/` is an archive. Do not restore, move, clean, or deploy it without explicit user approval.

Every material architecture, deployment, scope, or completed milestone change must update the relevant file in `DOC/`. Never record credentials, private data, tokens, payment keys, or server secrets in Git.

Keep strict module boundaries. A backend module owns its router, schemas, service, repository, models, tests and migrations. A frontend feature owns its route/UI state but may import only permitted shared libraries. Public showcase blocks are versioned and validated; never store arbitrary HTML, CSS, or executable code in their editable data. The training-program constructor remains a typed domain model, not a generic CMS.
