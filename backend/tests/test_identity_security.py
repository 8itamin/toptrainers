from pydantic import ValidationError

from toptrainers_api.core.auth import create_token, decode_token, password_is_strong
from toptrainers_api.modules.identity.schemas import RegisterAccountRequest


def test_password_policy_requires_length_and_character_classes() -> None:
    assert password_is_strong("CorrectHorse77")
    assert not password_is_strong("alllowercase77")
    assert not password_is_strong("ALLUPPERCASE77")
    assert not password_is_strong("NoDigitsAtAll")


def test_public_registration_rejects_admin_role() -> None:
    try:
        RegisterAccountRequest(
            email="trainer@example.test", password="CorrectHorse77", role="admin"
        )
    except ValidationError:
        return
    raise AssertionError("Public registration must never accept the admin role")


def test_session_token_contains_a_session_id() -> None:
    payload = decode_token(create_token("account-id", "trainer", "session-id"))
    assert payload["sub"] == "account-id"
    assert payload["role"] == "trainer"
    assert payload["sid"] == "session-id"
