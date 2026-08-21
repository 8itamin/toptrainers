"""Export the FastAPI schema used to generate the frontend API contract.

Run from ``backend/`` after installing the package:
    python scripts/export_openapi.py
"""

from __future__ import annotations

import json
from pathlib import Path

from toptrainers_api.main import app


def main() -> None:
    output = Path(__file__).resolve().parents[1] / "openapi" / "openapi.json"
    output.parent.mkdir(exist_ok=True)
    schema = json.dumps(app.openapi(), ensure_ascii=False, indent=2) + "\n"
    output.write_text(schema, encoding="utf-8")
    print(f"Exported OpenAPI schema to {output}")


if __name__ == "__main__":
    main()
