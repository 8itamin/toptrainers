# TopTrainers — continuity rules

Before starting a task, read these living project records:

1. `DOC/PROJECT_MEMORY.md`
2. `DOC/DECISIONS.md`
3. `DOC/ROADMAP.md`

Use the project documentation in `._DOC/` as the original product source. It is currently untracked and must not be moved, renamed, or edited unless the user explicitly asks for that. The tracked `DOC/` directory contains the concise working memory and plan for continuing sessions.

After a material decision, completed milestone, change of stack, or scope change, update the relevant record. Keep the memory concise and factual: status, decision, reason, owner, date, next action. Do not store credentials, personal data, payment keys, or other secrets there.

Project conventions:

- Treat `arc/` as an archive, not an active implementation base.
- The root Astro site, `app/` Angular prototype, and `backend/` NestJS auth prototype are current scaffolds, not the approved target architecture.
- Preserve unrelated uncommitted work. Do not clean, reset, move, or delete it without explicit approval.
- Keep new product code modular: a feature owns its UI, domain rules, API surface, tests, and migrations; cross-feature access goes through a public contract or domain event.
- Public showcases are assembled from a versioned registry of validated blocks. Never store arbitrary HTML or executable code in editable block data. Do not turn the trainer's program constructor or the client PWA into a generic CMS: training days and exercise blocks stay typed domain entities.
