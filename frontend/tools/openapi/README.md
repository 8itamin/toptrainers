# OpenAPI generation

FastAPI owns the contract. This tool reads a local exported OpenAPI JSON document and writes a
deterministic TypeScript snapshot into `libs/shared/contracts/src/generated/`.

It does not make network calls, does not contain credentials, and deliberately refuses malformed
or non-OpenAPI JSON. The default input is `backend/openapi/openapi.json`; export it first:

```powershell
cd ..\backend
python scripts\export_openapi.py
cd ..\frontend
pnpm api:generate
```

The first generated artifact exposes the exact OpenAPI document and its path union. Add a typed
HTTP client only after endpoint schemas are stable; keep generated code in this library rather
than duplicating API DTOs in a feature library.
