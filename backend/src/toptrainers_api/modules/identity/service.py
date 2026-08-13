from __future__ import annotations

import asyncio
import hashlib
import secrets
import smtplib
import ssl
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from urllib.parse import urlencode

from fastapi import HTTPException, Request, status
from redis.asyncio import Redis
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.core.config import settings
from toptrainers_api.modules.identity.models import AuthSession, AuthToken

VERIFY_EMAIL = "verify_email"
RESET_PASSWORD = "reset_password"


def utcnow() -> datetime:
    return datetime.now(UTC)


def hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def issue_secret() -> str:
    return secrets.token_urlsafe(32)


async def issue_one_time_token(
    session: AsyncSession, account_id: str, purpose: str, lifetime: timedelta
) -> str:
    await session.execute(
        update(AuthToken)
        .where(
            AuthToken.account_id == account_id,
            AuthToken.purpose == purpose,
            AuthToken.used_at.is_(None),
        )
        .values(used_at=utcnow())
    )
    raw_token = issue_secret()
    session.add(
        AuthToken(
            id=secrets.token_hex(16),
            account_id=account_id,
            token_hash=hash_secret(raw_token),
            purpose=purpose,
            expires_at=utcnow() + lifetime,
        )
    )
    return raw_token


async def revoke_account_sessions(session: AsyncSession, account_id: str) -> None:
    await session.execute(
        update(AuthSession)
        .where(AuthSession.account_id == account_id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )


def _build_link(path: str, token: str) -> str:
    return f"{settings.public_app_url.rstrip('/')}{path}?{urlencode({'token': token})}"


def _send_smtp(recipient: str, subject: str, html: str) -> None:
    if not all(
        [
            settings.smtp_host,
            settings.smtp_username,
            settings.smtp_password,
            settings.smtp_from_email,
        ]
    ):
        raise RuntimeError("SMTP is not configured")

    message = EmailMessage()
    message["From"] = settings.smtp_from_email
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content("Откройте письмо в почтовом клиенте с поддержкой HTML.")
    message.add_alternative(html, subtype="html")
    if settings.smtp_use_starttls:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as client:
            client.starttls(context=ssl.create_default_context())
            client.login(settings.smtp_username, settings.smtp_password)
            client.send_message(message)
    else:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15) as client:
            client.login(settings.smtp_username, settings.smtp_password)
            client.send_message(message)


async def send_verification_email(recipient: str, token: str) -> None:
    link = _build_link("/auth/verify-email", token)
    html = (
        "<p>Подтвердите email для TopTrainers:</p>"
        f'<p><a href="{link}">Подтвердить email</a></p>'
        "<p>Ссылка действует 24 часа.</p>"
    )
    await asyncio.to_thread(
        _send_smtp, recipient, "Подтвердите email в TopTrainers", html
    )


async def send_password_reset_email(recipient: str, token: str) -> None:
    link = _build_link("/auth/reset-password", token)
    html = (
        "<p>Для сброса пароля TopTrainers перейдите по ссылке:</p>"
        f'<p><a href="{link}">Сбросить пароль</a></p>'
        "<p>Ссылка действует 30 минут. Если это были не вы, проигнорируйте письмо.</p>"
    )
    await asyncio.to_thread(_send_smtp, recipient, "Сброс пароля TopTrainers", html)


async def enforce_rate_limit(
    redis: Redis, request: Request, scope: str, subject: str, limit: int, window: int
) -> None:
    client_ip = request.client.host if request.client else "unknown"
    subject_hash = hash_secret(subject.lower())[:24]
    key = f"auth-rate:{scope}:{client_ip}:{subject_hash}"
    try:
        attempts = await redis.incr(key)
        if attempts == 1:
            await redis.expire(key, window)
    except Exception as error:
        raise HTTPException(
            status_code=503, detail="Authentication temporarily unavailable"
        ) from error
    if attempts > limit:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Try again later")
