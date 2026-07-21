# API contract

`openapi.json` is generated from the FastAPI application and is intentionally not edited by hand.

```bash
python scripts/export_openapi.py
```

The frontend consumes this schema to generate the contents of
`frontend/libs/shared/contracts/src/generated/`. The backend schema is the single source of truth.
