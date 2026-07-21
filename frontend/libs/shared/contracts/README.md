# OpenAPI contracts

`src/generated/openapi-schema.ts` is generated from the FastAPI OpenAPI schema. The
checked-in placeholder keeps the workspace type-checkable before the first API export.

The backend is the sole contract source. Export its schema, then regenerate from the
frontend workspace:

```powershell
cd ..\backend
python scripts\export_openapi.py
cd ..\frontend
pnpm api:generate
```

The generator rejects a non-OpenAPI JSON document and produces a deterministic TypeScript
schema snapshot. A typed HTTP client can be layered on this generated schema only after the
MVP API endpoints stabilize; do not hand-author duplicate DTOs in feature code.
