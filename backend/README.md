# TopTrainers API

The API is a FastAPI modular monolith. Each domain module owns `router → schemas → service → repository → models → tests/migrations`. Cross-module access happens through explicit public services or domain events, never by importing another module's repository.

## Commands

```bash
python -m venv .venv
python -m pip install -e ".[dev]"
alembic upgrade head
uvicorn toptrainers_api.main:app --reload --port 8000
pytest
```

On Windows, activate with `.venv\Scripts\Activate.ps1`; on Linux/macOS, use
`source .venv/bin/activate`. If PostgreSQL and Redis run from the developer
Compose overlay, export `TT_DATABASE_URL` with host `127.0.0.1` and
`TT_REDIS_URL=redis://127.0.0.1:6379/0` before running the API.

The liveness endpoint is `/api/v1/health/live`; readiness additionally checks PostgreSQL and Redis at `/api/v1/health/ready`.
