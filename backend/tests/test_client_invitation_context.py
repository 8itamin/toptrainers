from unittest.mock import AsyncMock

import pytest

from toptrainers_api.modules.identity import service


@pytest.mark.asyncio
async def test_verification_preserves_invite_without_query_token(monkeypatch):
    send = AsyncMock()
    monkeypatch.setattr(service.asyncio, "to_thread", send)
    await service.send_verification_email("test@example.com", "verification-secret", "join-secret")
    html = send.call_args.args[3]
    assert "#invite=join-secret" in html
    assert "&invite=" not in html
