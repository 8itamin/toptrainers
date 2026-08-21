from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from datetime import UTC, datetime
from typing import Annotated, cast

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.config import settings
from toptrainers_api.core.db import get_session
from toptrainers_api.modules.identity.models import AuthSession

bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        salt_hex, digest_hex = encoded.split("$", 1)
        digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1)
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def create_token(account_id: str, role: str, session_id: str) -> str:
    payload = {
        "sub": account_id,
        "role": role,
        "sid": session_id,
        "exp": int(time.time()) + 60 * 60 * 24 * settings.auth_session_days,
    }
    raw = json.dumps(payload, separators=(",", ":")).encode()
    body = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    signature = hmac.new(settings.jwt_signing_key.encode(), body.encode(), hashlib.sha256).digest()
    return f"{body}.{base64.urlsafe_b64encode(signature).decode().rstrip('=')}"


def decode_token(token: str) -> dict[str, object]:
    try:
        body, encoded_signature = token.split(".", 1)
        expected = hmac.new(
            settings.jwt_signing_key.encode(), body.encode(), hashlib.sha256
        ).digest()
        actual = base64.urlsafe_b64decode(encoded_signature + "=")
        if not hmac.compare_digest(expected, actual):
            raise ValueError
        payload = cast(
            dict[str, object],
            json.loads(base64.urlsafe_b64decode(body + "==")),
        )
        expiration = cast(int | str | bytes | bytearray, payload["exp"])
        if int(expiration) < int(time.time()):
            raise ValueError
        return payload
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from None


def password_is_strong(password: str) -> bool:
    """Require length plus mixed character classes; never log a password."""
    return (
        len(password) >= 12
        and any(character.islower() for character in password)
        and any(character.isupper() for character in password)
        and any(character.isdigit() for character in password)
    )


async def current_account(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    """Authenticate a non-revoked browser session; bearer is temporary compatibility."""
    token = request.cookies.get(settings.auth_cookie_name)
    if not token and credentials is not None:
        token = credentials.credentials
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")

    payload = decode_token(token)
    session_id = payload.get("sid")
    if not isinstance(session_id, str):
        raise HTTPException(status_code=401, detail="Invalid token")
    auth_session = await session.scalar(select(AuthSession).where(AuthSession.id == session_id))
    now = datetime.now(UTC)
    if not auth_session or auth_session.revoked_at is not None or auth_session.expires_at <= now:
        raise HTTPException(status_code=401, detail="Session expired")
    return payload
