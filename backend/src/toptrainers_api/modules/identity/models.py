from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from toptrainers_api.core.db import Base


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    # Keep room for the versioned PBKDF2 encoding and future password-hash upgrades.
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), index=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class AuthToken(Base):
    __tablename__ = "auth_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    account_id: Mapped[str] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    purpose: Mapped[str] = mapped_column(String(32), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    account_id: Mapped[str] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
