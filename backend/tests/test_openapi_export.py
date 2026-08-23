from __future__ import annotations

import json
from pathlib import Path

from toptrainers_api.main import app


def test_checked_in_openapi_matches_app_schema() -> None:
    contract = Path(__file__).resolve().parents[1] / "openapi" / "openapi.json"
    checked_in = json.loads(contract.read_text(encoding="utf-8"))
    assert checked_in == app.openapi()
