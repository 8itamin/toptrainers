# TopTrainers

TopTrainers is a mobile-first platform for fitness trainers and their clients.

## Repository layout

```text
frontend/  Nx + Angular 21: PWA (`app`) and SSR showcase (`showcase`)
backend/   FastAPI modular monolith and Alembic migrations
infra/     Docker Compose, Nginx gateway, deployment and recovery runbooks
DOC/       project memory, architectural decisions and roadmap
arc/       archived pre-rebuild files; never used by build or deployment
```

The frontend and API are deliberately separated runtimes. FastAPI/OpenAPI is the sole source of API contracts; generated TypeScript contracts live in `frontend/libs/shared/contracts/src/generated/`.

## Local development

1. Copy `.env.example` to a local, untracked `.env` and change all development passwords.
2. For a natively running API, start PostgreSQL and Redis through the loopback-only developer overlay:

   ```powershell
   docker compose --env-file .env -f infra/compose/compose.yaml -f infra/compose/compose.dev.yaml up -d postgres redis
   ```

3. In `backend/`, create a Python 3.13+ virtual environment and run `python -m pip install -e ".[dev]"`. For this native mode, set the local dependency URLs before starting the API:

   ```powershell
   $env:TT_DATABASE_URL = 'postgresql+asyncpg://toptrainers:change-me@127.0.0.1:5432/toptrainers'
   $env:TT_REDIS_URL = 'redis://127.0.0.1:6379/0'
   ```
4. In `frontend/`, run `pnpm install` and then `pnpm nx serve app` or `pnpm nx serve showcase`.

`infra/compose/compose.dev.yaml` is deliberately a local-only overlay. The base Compose file used on the Tailnet host never publishes the data services.

See [the deployment runbook](infra/README.md) before using the production host.

## Production host

`100.90.138.119` is in the Tailscale/CGNAT range. The default production Compose configuration therefore binds the gateway only to `127.0.0.1:8080`; Tailscale Serve may expose it to the tailnet. Do not point public DNS at this address or open databases to the network.

When preparing `/etc/toptrainers/prod.env`, set `TT_ENVIRONMENT=production` and
`TT_OPENAPI_ENABLED=false`; the deployment script rejects a production launch without them.
