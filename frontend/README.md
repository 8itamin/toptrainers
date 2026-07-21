# TopTrainers frontend

This Nx workspace contains deliberately separate rendering profiles:

- `apps/app` — installable Angular PWA, with trainer and client role routes;
- `apps/showcase` — Angular SSR public showcase;
- `libs/ui` — reusable visual components;
- `libs/shared/*` — runtime configuration, domain types and future OpenAPI contract;
- `libs/offline` — browser-only IndexedDB queue foundation;
- `libs/pwa/*` and `libs/showcase/*` — product feature libraries isolated by Nx tags.

The ESLint `@nx/enforce-module-boundaries` rule prevents the SSR showcase from importing
PWA/offline code, and prevents shared code from depending on product features.

## Bootstrap

Use Node.js 22+ and pnpm 11.9+.

```powershell
corepack enable
pnpm install
pnpm serve:app
pnpm serve:showcase
```

The initial trusted `pnpm install` creates `pnpm-lock.yaml`. Review and commit that lockfile
before CI or a production image is allowed to use `--frozen-lockfile`. `runtime-config.json`
contains only public deployment values; it must never contain credentials.

The initial service-worker policy caches only the application shell and static assets. It does
not cache authenticated `/api/v1` responses until logout, invalidation and per-user offline
retention rules are designed; queued mutations belong in `libs/offline`.

## Frontend boundaries

PWA routes may use `scope:pwa`, `scope:offline`, `scope:shared` and `scope:ui`. Showcase
routes may use `scope:showcase`, `scope:shared` and `scope:ui`. The editable showcase document
is restricted to versioned `hero`, `about`, `credentials`, `program-list`, and `contacts-cta`
blocks. Arbitrary HTML, CSS, and executable code are intentionally unsupported.
