from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from pydantic import ValidationError

from toptrainers_api.core.errors import BusinessRuleError
from toptrainers_api.modules.clients.join_service import validate_join
from toptrainers_api.modules.clients.router import router
from toptrainers_api.modules.clients.schemas import ClientCardWrite


def test_card_name_and_email_validation():
    card = ClientCardWrite(display_name="  Иван  ", contact_email="Ivan@example.com")
    assert card.display_name == "Иван"
    assert card.contact_email == "ivan@example.com"
    with pytest.raises(ValidationError):
        ClientCardWrite(display_name="   ")
    with pytest.raises(ValidationError):
        ClientCardWrite(display_name="Иван", contact_email="invalid")
    with pytest.raises(ValidationError):
        ClientCardWrite(display_name=123)


def test_crm_contract():
    app = FastAPI()
    app.include_router(router)
    paths = app.openapi()["paths"]
    assert "post" in paths["/clients/cards"]
    assert "get" in paths["/clients/cards"]
    assert "post" in paths["/clients/join/accept"]
    assert "post" in paths["/clients/cards/{card_id}/invite/email"]


def test_expired_cancelled_join_is_rejected():
    for state, expiry in [
        ("CANCELLED", datetime.now(UTC) + timedelta(days=1)),
        ("PENDING", datetime.now(UTC) - timedelta(seconds=1)),
    ]:
        with pytest.raises(BusinessRuleError):
            validate_join(SimpleNamespace(status=state, expires_at=expiry))
